// Fichier : frontend/app.js (Code Final avec URL RENDER)
// -------------------------------------------------------------------

let cy = null; 
let graphData = {
    utilisateurs: [],
    relations: [],
    serveurs: []
};


// --- CONFIGURATION LOCALE ---
const CLIENT_ID = '1454871638972694738'; 
const REDIRECT_URI = 'https://friendtree0.github.io/frontend/index.html'; 
const SCOPE = 'identify guilds'; 
const DISCORD_API_URL = 'https://discord.com/api/v10';
// URL publique de votre serveur Proxy Render
const PROXY_API_BASE_URL = 'https://friendtree0-github-io.onrender.com/api'; 
// ---------------------------------------------------

// --- LOGIQUE DRAG AND DROP POUR LE PANNEAU DE DÉTAILS ---

const makeDraggable = (element) => {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    const dragMouseDown = (e) => {
        e = e || window.event;
        if (e.target.tagName === 'CODE' || e.target.tagName === 'STRONG') return;

        e.preventDefault();

        pos3 = e.clientX;
        pos4 = e.clientY;
        
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    };

    const elementDrag = (e) => {
        e = e || window.event;
        e.preventDefault();

        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        let newTop = element.offsetTop - pos2;
        let newLeft = element.offsetLeft - pos1;
        
        element.style.top = newTop + "px";
        element.style.left = newLeft + "px";
    };

    const closeDragElement = () => {
        document.onmouseup = null;
        document.onmousemove = null;
    };

    element.onmousedown = dragMouseDown;
};


// --- Fonction pour afficher les détails du nœud ---
const afficherDetailsNoeud = (nodeId) => {
    const nodeData = graphData.utilisateurs.find(u => u.id === nodeId) || graphData.serveurs.find(s => s.id === nodeId);
    const detailsContainer = document.getElementById('details-content');

    if (!nodeData) {
        detailsContainer.innerHTML = `<p style="color:red;">Erreur: Données de nœud introuvables.</p>`;
        return;
    }

    let typeLabel = nodeData.type === 'utilisateur' ? 'Utilisateur Connecté' : 'Serveur Discord';
    if (nodeData.id === CLIENT_ID) typeLabel = 'Utilisateur Principal';

    const couleurDot = `<span style="display:inline-block; width:10px; height:10px; background-color:${nodeData.couleur}; border-radius:50%; margin-right:5px;"></span>`;

    let htmlContent = `
        <p><strong>Nom:</strong> ${nodeData.nom}</p>
        <p><strong>Type:</strong> ${couleurDot} ${typeLabel}</p>
        <p><strong>ID:</strong> <code>${nodeData.id}</code></p>
    `;
    
    if (nodeData.dateExport) {
        const lastExportDate = new Date(nodeData.dateExport).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        htmlContent += `<p style="font-size: 0.85em; color: #bbb;">(Dernière analyse : ${lastExportDate})</p>`;
    }
    
    detailsContainer.innerHTML = htmlContent;
    
    const detailsPanel = document.getElementById('details-panel');
    if(detailsPanel) {
        detailsPanel.style.display = 'block'; 
    }
};


// --- Fonctions Cytoscape ---

const preparerElementsGraphe = (utilisateurs, relations, serveurs) => {
    const elements = [];
    
    utilisateurs.forEach(u => {
        elements.push({ data: { id: u.id, label: u.nom, color: u.couleur || '#ccc', type: u.type }, group: 'nodes' });
    });
    
    serveurs.forEach(s => {
        elements.push({ data: { id: s.id, label: s.nom, color: s.couleur || '#99aab5', type: s.type }, group: 'nodes' });
    });
    
    relations.forEach((r) => {
        elements.push({ 
            data: { source: r.source_id, target: r.cible_id, weight: r.poids || 1, type: r.type }, 
            group: 'edges',
        });
    });
    return elements;
};

const mettreAJourGraphe = (utilisateurs, relations, serveurs, forceRedraw = false) => {
    if (cy && !forceRedraw) { return; }
    
    const elements = preparerElementsGraphe(utilisateurs, relations, serveurs);
    const style = [
        { selector: 'node', style: {
            'background-color': 'data(color)', 'label': 'data(label)', 'color': '#fff', 
            'text-valign': 'center', 'text-halign': 'right', 'font-size': '12px', 
            'text-shadow-blur': 0,
            'width': '60px', 'height': '60px',
        }},
        { selector: 'node[type = "serveur"]', style: {
            'shape': 'round-rectangle', 'width': '80px', 'height': '30px', 'text-halign': 'center', 'text-valign': 'top',
            'font-size': '10px',
        }},
        { selector: 'node:selected', style: {
            'border-width': 3, 'border-color': '#fff', 'border-opacity': 0.7,
            'text-outline-color': '#000', 'text-outline-width': 2,
        }},
        { selector: 'edge', style: {
            'width': 'data(weight)', 'line-color': '#4f545c', 'target-arrow-shape': 'none', 
            'curve-style': 'bezier', 'opacity': 0.6
        }},
        { selector: 'edge[type = "serveur_commun"]', style: {
            'line-color': '#f04747', 'width': 3, 'opacity': 1.0 
        }}
    ];

    const cyContainer = document.getElementById('cy');

    if (cy) { cy.destroy(); }
    cyContainer.innerHTML = ''; 
    
    try {
         cy = cytoscape({
            container: cyContainer, elements: elements, style: style,
            layout: { name: 'concentric', fit: true, padding: 30, animate: true, animationDuration: 500 }
        });
        document.getElementById('connexion-status').textContent = `Graphe chargé : ${utilisateurs.length} utilisateurs, ${serveurs.length} serveurs.`;
        
        cy.on('tap', 'node', function(evt){
            const node = evt.target;
            afficherDetailsNoeud(node.id());
        });
        
        cy.on('tap', function(evt){
            if(evt.target === cy){
                document.getElementById('details-content').innerHTML = `Cliquez sur un utilisateur sur le graphe pour voir les détails ici.`;
                document.getElementById('details-panel').style.display = 'none';
            }
        });
        
    } catch (e) { 
        console.error("Erreur lors de l'initialisation de Cytoscape:", e); 
        document.getElementById('connexion-status').textContent = "Statut : Erreur critique d'affichage du graphe.";
    }
};

const detecterRelationsCommunes = () => {
    const userGuilds = new Map();
    
    graphData.utilisateurs.forEach(user => {
        userGuilds.set(user.id, new Set());
    });

    graphData.relations.filter(r => r.type === 'membre_de').forEach(r => {
        if (userGuilds.has(r.source_id)) {
            userGuilds.get(r.source_id).add(r.cible_id);
        }
    });

    const commonLinks = new Set();
    const userIDs = Array.from(userGuilds.keys());
    for (let i = 0; i < userIDs.length; i++) {
        for (let j = i + 1; j < userIDs.length; j++) {
            const userA_ID = userIDs[i];
            const userB_ID = userIDs[j];
            
            const guildsA = userGuilds.get(userA_ID);
            const guildsB = userGuilds.get(userB_ID);
            
            const commonGuildsCount = Array.from(guildsA).filter(guildID => guildsB.has(guildID)).length;
            
            if (commonGuildsCount > 0) {
                const sortedIDs = [userA_ID, userB_ID].sort();
                const linkKey = `${sortedIDs[0]}-${sortedIDs[1]}`;
                
                if (!commonLinks.has(linkKey)) {
                    graphData.relations.push({
                        source_id: userA_ID, 
                        cible_id: userB_ID, 
                        poids: commonGuildsCount,
                        type: 'serveur_commun' 
                    });
                    commonLinks.add(linkKey);
                }
            }
        }
    }
    console.log(`✅ Détection de liens : ${commonLinks.size} liens 'serveur_commun' créés.`);
};


const fusionnerEtAnalyserDonnees = (allStoredData) => {
    const userMap = new Map();
    const serverMap = new Map();
    const relationsSet = new Set();
    const allRelations = [];
    
    allStoredData.forEach(storedMap => {
        storedMap.utilisateurs.forEach(u => userMap.set(u.id, {...userMap.get(u.id), ...u}));
        storedMap.serveurs.forEach(s => serverMap.set(s.id, {...serverMap.get(s.id), ...s}));
        
        storedMap.relations.forEach(r => {
            const key = `${r.source_id}-${r.cible_id}-${r.type}`;
            if (!relationsSet.has(key)) {
                allRelations.push(r);
                relationsSet.add(key);
            }
        });
    });

    graphData.utilisateurs = Array.from(userMap.values());
    graphData.serveurs = Array.from(serverMap.values());
    graphData.relations = allRelations;
    
    detecterRelationsCommunes();
    
    console.log(`Fusion complète. Totaux: ${graphData.utilisateurs.length} utilisateurs, ${graphData.serveurs.length} serveurs. Relations totales : ${graphData.relations.length}.`);
};


// --- LOGIQUE DISCORD / IMPORT ---

const connecterDiscord = () => {
    document.getElementById('connexion-status').textContent = "Statut : Connexion à Discord (demande de code)...";
    const encodedScope = encodeURIComponent(SCOPE); 
    const authUrl = `${DISCORD_API_URL}/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=${encodedScope}`;
    window.location.href = authUrl;
};

const analyserDonneesDiscord = (data) => { 
    const userData = data.userData;
    const guildsData = data.guildsData || []; 
    
    if (!userData) {
        console.error("Données de l'utilisateur invalides.");
        return;
    }
    
    document.getElementById('connexion-status').textContent = `Statut : Connecté en tant que ${userData.global_name || userData.username}. ${guildsData.length} serveurs récupérés.`;
};

const importerDonneesStockees = async (afterCodeGrant = false) => {
    document.getElementById('connexion-status').textContent = "Statut : Chargement et fusion de toutes les cartes sauvegardées...";
    const importUrl = `${PROXY_API_BASE_URL}/data/import`; 
    
    try {
        const response = await fetch(importUrl);
        const allStoredData = await response.json();
        
        if (response.ok && Array.isArray(allStoredData)) {
            
            fusionnerEtAnalyserDonnees(allStoredData);
            
            mettreAJourGraphe(graphData.utilisateurs, graphData.relations, graphData.serveurs, true);

            if (afterCodeGrant) {
                document.getElementById('connexion-status').textContent = `Statut : Connexion et fusion complètes. Carte prête (${graphData.utilisateurs.length} utilisateurs).`;
            } else {
                 document.getElementById('connexion-status').textContent = `Statut : ${graphData.utilisateurs.length} utilisateurs chargés depuis la sauvegarde.`;
            }

        } else {
            console.error("❌ Échec de la récupération des cartes stockées.", allStoredData);
            document.getElementById('connexion-status').textContent = "Statut : Erreur lors de l'importation des cartes stockées.";
        }

    } catch (error) {
        console.error("❌ Erreur de connexion au Proxy Cloud. L'API est-elle déployée et l'URL est-elle correcte ?", error);
        document.getElementById('connexion-status').textContent = "Statut : Échec - API Proxy Cloud non trouvé.";
    }
};

const echangerCodeContreInfos = async (code) => {
    const callbackUrl = `${PROXY_API_BASE_URL}/auth/callback?code=${code}`; 

    try {
        const response = await fetch(callbackUrl);
        const data = await response.json();
        
        if (response.ok) {
            console.log("✅ Données utilisateur et sauvegarde automatique réussies.");
            
            analyserDonneesDiscord(data);
            await importerDonneesStockees(true);

        } else {
            console.error(`❌ Échec de l'appel Proxy Code Grant.`, data);
            document.getElementById('connexion-status').textContent = `Statut : Échec Code Grant (${data.error || 'Erreur inconnue'}).`;
        }

    } catch (error) {
        console.error("❌ Erreur de connexion au Proxy Cloud.", error);
        document.getElementById('connexion-status').textContent = "Statut : Échec - API Proxy Cloud non trouvé.";
    }
};

const gererRedirectionOAuth = () => {
    const detailsPanel = document.getElementById('details-panel');
    if(detailsPanel) { detailsPanel.style.display = 'none'; }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code'); 
    const error = params.get('error');

    if (code) {
        document.getElementById('connexion-status').textContent = "Statut : Code Discord récupéré. Échange de jeton via Proxy...";
        window.history.replaceState({}, document.title, REDIRECT_URI); 
        echangerCodeContreInfos(code);
    } else if (error) {
        document.getElementById('connexion-status').textContent = `Statut : Échec d'autorisation (${error}). Vérifiez le portail Discord.`;
        window.history.replaceState({}, document.title, REDIRECT_URI); 
        importerDonneesStockees(false);
    } else {
        document.getElementById('connexion-status').textContent = "Statut : Tentative de chargement des données stockées...";
        importerDonneesStockees(false);
    }
};


// --- FONCTIONS UTILITIES ---

const reinitialiserGraphe = () => {
    if (confirm("Êtes-vous sûr de vouloir vider complètement la carte ? (Cela ne supprime PAS les fichiers sauvegardés sur le serveur)")) {
        graphData.utilisateurs = [];
        graphData.relations = [];
        graphData.serveurs = [];
        mettreAJourGraphe([], [], [], true); 
        document.getElementById('details-content').innerHTML = `Graphe local réinitialisé.`;
        document.getElementById('details-panel').style.display = 'none';
    }
};


// --- INITIALISATION DES ÉVÉNEMENTS ---
document.addEventListener('DOMContentLoaded', () => {
    const detailsPanel = document.getElementById('details-panel');
    if(detailsPanel) {
        makeDraggable(detailsPanel);
    }
    
    document.getElementById('btn-reset').addEventListener('click', reinitialiserGraphe);
    document.getElementById('btn-discord-connect').addEventListener('click', connecterDiscord);
    
    gererRedirectionOAuth();
});
