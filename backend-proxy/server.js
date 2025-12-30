// Fichier : backend-proxy/server.js (Code Final pour Déploiement Cloud)
// -------------------------------------------------------------------

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors'); 
const fs = require('fs').promises; 
const path = require('path');      

const app = express();
const PORT = 3000; 
const DISCORD_API_URL = 'https://discord.com/api/v10';
const DATA_FOLDER = path.join(__dirname, 'data'); 

// --- CONFIGURATION SÉCURISÉE (Utilisation des Variables d'Environnement de Render) ---
// Les valeurs à droite du || sont des valeurs locales de secours.
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'o1a61io7d32n8g9KOwYKst1t7RVodscY'; 
const CLIENT_ID = process.env.CLIENT_ID || '1454871638972694738';                    
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://friendtree0.github.io/';
// ----------------------------------------------------------------

app.use(cors()); 

// Fonction utilitaire pour formater les données utilisateur et serveurs
function preparerDonneesPourSauvegarde(userData, guildsData) {
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

    return { utilisateurs, relations, serveurs }; 
}

// 🔑 POINT DE TERMINAISON POUR L'ÉCHANGE DE CODE, LA RÉCUPÉRATION ET LA SAUVEGARDE
app.get('/api/auth/callback', async (req, res) => {
    
    console.log("--- ✅ APPEL RÉUSSI : TENTATIVE DE RÉCUPÉRATION DU CODE ---"); 
    
    const code = req.query.code;

    if (!code) {
        return res.status(400).json({ error: "Code d'autorisation manquant." });
    }

    const tokenExchangeUrl = `${DISCORD_API_URL}/oauth2/token`;
    const body = new URLSearchParams({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code',
        code: code, redirect_uri: REDIRECT_URI, 
        scope: 'identify guilds' 
    });

    try {
        const tokenResponse = await fetch(tokenExchangeUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', }, body: body.toString(), });
        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("❌ Échec de l'échange de jeton Discord:", tokenData);
            return res.status(tokenResponse.status).json({ error: "Échec de l'échange de jeton Discord", details: tokenData });
        }
        
        const accessToken = tokenData.access_token;
        const authHeaders = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

        // 2. Obtention de l'utilisateur
        const userUrl = `${DISCORD_API_URL}/users/@me`; 
        const userResponse = await fetch(userUrl, { method: 'GET', headers: authHeaders });
        const userData = await userResponse.json();
        
        // 3. Obtention des serveurs (guilds) de l'utilisateur
        const guildsUrl = `${DISCORD_API_URL}/users/@me/guilds`; 
        const guildsResponse = await fetch(guildsUrl, { method: 'GET', headers: authHeaders });
        let guildsData = []; 
        if (guildsResponse.ok) {
            guildsData = await guildsResponse.json();
        } else {
             console.warn(`Avertissement: Impossible d'obtenir les serveurs (Code: ${guildsResponse.status}).`);
        }

        // --- SAUVEGARDE AUTOMATIQUE ---
        if (userData) {
            const exportData = preparerDonneesPourSauvegarde(userData, guildsData);
            const fileName = `carte_${userData.id}.json`;
            const filePath = path.join(DATA_FOLDER, fileName);

            await fs.mkdir(DATA_FOLDER, { recursive: true }); 
            
            try {
                 await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
                 console.log(`✅ Données de ${userData.username} sauvegardées dans ${fileName} (${guildsData.length} serveurs).`);
            } catch (saveError) {
                 console.error(`❌ Échec CRITIQUE de la sauvegarde du fichier ${fileName}:`, saveError);
                 // La persistance des fichiers sur Render peut être éphémère.
            }
        }
        
        // 4. Renvoyer les données au Front-End
        return res.status(200).json({ userData, guildsData });
    
    } catch (error) {
        console.error("❌ Erreur générale du flux Code Grant/Sauvegarde:", error);
        return res.status(500).json({ error: "Erreur interne du serveur lors de l'authentification/sauvegarde." });
    }
});


// 💾 POINT DE TERMINAISON : LIRE ET RENVOYER TOUS LES FICHIERS JSON DU DOSSIER 'data'
app.get('/api/data/import', async (req, res) => {
    try {
        await fs.mkdir(DATA_FOLDER, { recursive: true });
        
        const files = await fs.readdir(DATA_FOLDER);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        const allData = [];

        for (const file of jsonFiles) {
            const filePath = path.join(DATA_FOLDER, file);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);
                
                if (Array.isArray(data.utilisateurs) && Array.isArray(data.relations)) {
                    data.serveurs = data.serveurs || []; 
                    allData.push(data);
                } else {
                    console.warn(`Fichier ignoré (${file}) : structure de carte JSON invalide.`);
                }
            } catch (error) {
                console.error(`Erreur de lecture ou de parsing du fichier ${file}:`, error);
            }
        }

        return res.status(200).json(allData);

    } catch (error) {
        console.error("Erreur critique lors de l'accès aux fichiers du dossier 'data':", error);
        return res.status(500).json({ error: "Échec de la lecture des fichiers JSON stockés.", details: error.message });
    }
});


// Ligne modifiée pour écouter le port fourni par Render ou 3000 si en local
app.listen(process.env.PORT || PORT, () => {
    console.log(`Proxy Back-End démarré sur le port ${process.env.PORT || PORT}`);
    console.log(`Dossier de données pour l'importation/sauvegarde : ${DATA_FOLDER}`);
});
