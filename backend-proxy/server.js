// Fichier : backend-proxy/server.js (VERSION MONGODB PERSISTANTE ET KEEP-ALIVE)
// -------------------------------------------------------------------

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors'); 
const { MongoClient } = require('mongodb'); // Import MongoDB
const path = require('path'); 

const app = express();
const PORT = 3000; 
const DISCORD_API_URL = 'https://discord.com/api/v10';
// DATA_FOLDER n'est plus utilisé pour la persistance, mais gardé pour référence
const DATA_FOLDER = path.join(__dirname, 'data'); 

// --- CONFIGURATION MONGODB ---
// URI doit être définie comme variable d'environnement sur Render
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/';
const DB_NAME = 'discord-social-graph-db';
const COLLECTION_NAME = 'user_maps';
let db; // Variable globale pour la connexion à la base de données
// -----------------------------


// --- CONFIGURATION DISCORD ---
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'o1a61io7d32n8g9KOwYKst1t7RVodscY'; 
const CLIENT_ID = process.env.CLIENT_ID || '1454871638972694738'; 
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://friendtree0.github.io/';
// -----------------------------

app.use(cors()); 

// FONCTION DE CONNEXION À LA BASE DE DONNÉES (Exécutée au démarrage)
async function connectDB() {
    try {
        console.log("Tentative de connexion à MongoDB...");
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log(`✅ MongoDB connecté. Base de données: ${DB_NAME}`);
    } catch (error) {
        console.error("❌ Échec de la connexion MongoDB. Vérifiez MONGO_URI.", error.message);
        // Le serveur peut continuer de fonctionner, mais les fonctions de sauvegarde/import échoueront.
        process.exit(1); // Arrêter le service si la base de données est cruciale
    }
}

// Fonction utilitaire pour formater les données utilisateur et serveurs
function preparerDonneesPourSauvegarde(userData, guildsData) {
    // ... (Logique de préparation des données inchangée)
    const utilisateurs = [];
    const relations = [];
    const serveurs = [];

    const mainUserID = userData.id;
    const mainUserName = userData.global_name || userData.username; 
    
    utilisateurs.push({ 
        id: mainUserID, 
        nom: mainUserName, 
        couleur: '#5865f2', 
        type: 'utilisateur', 
        dateExport: new Date().toISOString() 
    }); 

    if (Array.isArray(guildsData)) { 
        guildsData.forEach(g => {
            serveurs.push({ 
                id: g.id, 
                nom: g.name, 
                couleur: '#99aab5', 
                type: 'serveur' 
            });

            relations.push({
                source_id: mainUserID, 
                cible_id: g.id, 
                poids: 1, 
                type: 'membre_de'
            });
        });
    }
    
    // Le document MongoDB contiendra l'ID utilisateur comme clé principale
    return { 
        _id: mainUserID, 
        utilisateurs, 
        relations, 
        serveurs, 
        dateSauvegarde: new Date()
    };
}


// --- NOUVELLE FONCTIONNALITÉ : ENDPOINT DE STATUT (KEEP-ALIVE) ---
// Ceci est l'endpoint à utiliser dans UptimeRobot (ou un service similaire)
// URL à utiliser: https://friendtree0-github-io.onrender.com/api/status
app.get('/api/status', (req, res) => {
    // Réponse rapide pour indiquer que le serveur est éveillé.
    // Ajout d'une vérification basique de la connexion à la base de données
    const status = db ? "operational" : "db_disconnected";
    
    // Si la base de données n'est pas connectée, renvoyer 503 (Service Unavailable)
    if (!db) {
        console.warn("⚠️ Keep-Alive: DB non connectée, renvoi de 503.");
        return res.status(503).json({ status: "fail", message: "Proxy est éveillé, mais la base de données est déconnectée." });
    }
    
    console.log(`✅ Keep-Alive: Ping reçu à ${new Date().toLocaleTimeString()}. Proxy éveillé.`);
    return res.status(200).json({ status: "ok", message: "Proxy est éveillé et opérationnel avec DB." });
});
// -----------------------------------------------------------------


// 🔑 POINT DE TERMINAISON POUR L'ÉCHANGE DE CODE, LA RÉCUPÉRATION ET LA SAUVEGARDE
app.get('/api/auth/callback', async (req, res) => {
    
    if (!db) { return res.status(503).json({ error: "Service de base de données non disponible." }); }
    
    console.log("--- ✅ APPEL RÉUSSI : TENTATIVE DE RÉCUPÉRATION DU CODE ---"); 
    
    const code = req.query.code;

    if (!code) { return res.status(400).json({ error: "Code d'autorisation manquant." }); }

    const tokenExchangeUrl = `${DISCORD_API_URL}/oauth2/token`;
    // ... (Préparation du body pour l'échange de jeton)
    const body = new URLSearchParams({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code',
        code: code, redirect_uri: REDIRECT_URI, 
        scope: 'identify guilds' 
    });

    try {
        // 1. Échange de code
        const tokenResponse = await fetch(tokenExchangeUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', }, body: body.toString(), });
        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("❌ Échec de l'échange de jeton Discord:", tokenData);
            return res.status(tokenResponse.status).json({ error: "Échec de l'échange de jeton Discord", details: tokenData });
        }
        
        const accessToken = tokenData.access_token;
        const authHeaders = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

        // 2. Obtention de l'utilisateur et des serveurs
        const userUrl = `${DISCORD_API_URL}/users/@me`; 
        const userData = await (await fetch(userUrl, { method: 'GET', headers: authHeaders })).json();
        
        const guildsUrl = `${DISCORD_API_URL}/users/@me/guilds`; 
        const guildsResponse = await fetch(guildsUrl, { method: 'GET', headers: authHeaders });
        let guildsData = []; 
        if (guildsResponse.ok) { guildsData = await guildsResponse.json(); }


        // --- SAUVEGARDE AUTOMATIQUE DANS MONGODB (Remplacement de fs.writeFile) ---
        if (userData && db) {
            const exportData = preparerDonneesPourSauvegarde(userData, guildsData);
            
            try {
                 // upsert: true met à jour si _id existe, ou insère sinon
                 await db.collection(COLLECTION_NAME).updateOne(
                     { _id: userData.id }, 
                     { $set: exportData },
                     { upsert: true }
                 );
                 console.log(`✅ Données de ${userData.id} sauvegardées/mises à jour dans MongoDB.`);
            } catch (saveError) {
                 console.error(`❌ Échec CRITIQUE de la sauvegarde MongoDB:`, saveError);
                 return res.status(500).json({ error: "Erreur interne du serveur lors de la sauvegarde MongoDB." });
            }
        }
        
        // 3. Renvoyer les données au Front-End
        return res.status(200).json({ userData, guildsData });
    
    } catch (error) {
        console.error("❌ Erreur générale du flux Code Grant/Sauvegarde:", error);
        return res.status(500).json({ error: "Erreur interne du serveur lors de l'authentification/sauvegarde." });
    }
});


// 💾 POINT DE TERMINAISON : LIRE ET RENVOYER TOUS LES DOCUMENTS DE LA BASE DE DONNÉES
app.get('/api/data/import', async (req, res) => {
    
    if (!db) { return res.status(503).json({ error: "Service de base de données non disponible." }); }

    try {
        // Remplacement de fs.readdir par la requête MongoDB
        const cursor = db.collection(COLLECTION_NAME).find({});
        const allData = await cursor.toArray();
        
        // Nettoyage des données pour l'envoi au Front-End (retirer le champ _id créé par MongoDB si désiré)
        const cleanData = allData.map(doc => ({
            utilisateurs: doc.utilisateurs,
            relations: doc.relations,
            serveurs: doc.serveurs
        }));

        return res.status(200).json(cleanData);

    } catch (error) {
        console.error("Erreur critique lors de la lecture des données MongoDB:", error);
        return res.status(500).json({ error: "Échec de la lecture des cartes stockées dans la base de données.", details: error.message });
    }
});


// Lancement du serveur ET de la connexion à la DB
connectDB().then(() => {
    app.listen(process.env.PORT || PORT, () => {
        console.log(`Proxy Back-End démarré sur le port ${process.env.PORT || PORT}`);
        console.log("Le stockage est maintenant PERSISTANT via MongoDB.");
    });
});
