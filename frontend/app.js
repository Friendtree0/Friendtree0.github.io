// Fichier : frontend/app.js (Code Final avec Nouvelles Fonctionnalités)
// -------------------------------------------------------------------

let cy = null; 
let graphData = {
    utilisateurs: [],
    relations: [],
    serveurs: []
};
let serversVisible = true; // État pour le bouton Masquer/Afficher les serveurs
let serversHiddenLayout; // Pour stocker la position des nœuds quand les serveurs sont masqués

// --- CONFIGURATION LOCALE ---
const CLIENT_ID = '1454871638972694738'; 
const REDIRECT_URI = 'https://friendtree0.github.io/'; 
const SCOPE = 'identify guilds'; 
const DISCORD_API_URL = 'https://discord.com/api/v10';
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
    
    // --- AJOUT : Boutons d'Action (Localiser/Trajet) ---
    if (nodeData.type === 'utilisateur') {
        htmlContent += `<hr style="border-color:#4f545c; margin: 10px 0;">`;
        htmlContent += `<button onclick="localiserNoeud('${nodeId}')" style="background-color:#4752c4; color:white; border:none; padding:5px 10px; border-radius:4px; margin-right:5px; cursor:pointer;">Localiser</button>`;
        htmlContent += `<button onclick="demarrerTrajet('${nodeId}')" style="background-color:#f04747; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Trajet</button>`;
    }
    // ----------------------------------------------------

    detailsContainer.innerHTML = htmlContent;
    
    const detailsPanel = document.getElementById('details-panel');
    if(detailsPanel) {
        detailsPanel.style.display = 'block'; 
    }
};


// --- NOUVELLE FONCTION 1 : Localiser un Utilisateur ---
const localiserNoeud = (nodeId) => {
    if (!cy) return;
    
    cy.elements().removeClass('highlighted'); // Enlever l'ancien focus
    const node = cy.getElementById(nodeId);
    
    if (node.length) {
        node.addClass('highlighted');
        cy.animate({
            fit: { eles: node, padding: 100 }, // Zoom sur l'utilisateur
            duration: 500
        });
        document.getElementById('connexion-status').textContent = `Statut : Localisation effectuée sur l'utilisateur ${node.data('label')}.`;
    }
};

// --- NOUVELLE FONCTION 2 : Trajet entre Deux Utilisateurs (Chemin le plus court) ---
let trajetSourceId = null; 

const demarrerTrajet = (sourceId) => {
    if (!cy) return;
    
    if (trajetSourceId === sourceId) {
        // Double-clic, on annule
        trajetSourceId = null;
        cy.elements().removeClass('path highlighted');
        document.getElementById('connexion-status').textContent = "Statut : Sélection du trajet annulée.";
        return;
    }

    if (trajetSourceId) {
        // C'est la cible (Target)
        const targetId = sourceId;
        
        // On n'utilise que les liens "serveur_commun" pour trouver un chemin social
        const users = cy.nodes('[type = "utilisateur"]');
        const path = users.dijkstra(cy.getElementById(trajetSourceId), (edge) => edge.data('type') === 'serveur_commun' ? 1 : 0, true);
        
        const pathToTarget = path.pathTo(cy.getElementById(targetId));

        if (pathToTarget.length) {
            cy.elements().removeClass('path highlighted'); 
            pathToTarget.addClass('path');
            pathToTarget.nodes().addClass('highlighted');
            
            cy.animate({
                fit: { eles: pathToTarget, padding: 100 },
                duration: 500
            });
            document.getElementById('connexion-status').textContent = `✅ Trajet trouvé entre ${cy.getElementById(trajetSourceId).data('label')} et ${cy.getElementById(targetId).data('label')} (via ${pathToTarget.edges().length} liens).`;
        } else {
            cy.elements().removeClass('path highlighted'); 
            document.getElementById('connexion-status').textContent = `❌ Aucun lien social direct (serveur_commun) trouvé entre ces deux utilisateurs.`;
        }
        
        trajetSourceId = null; // Réinitialiser le mode trajet
        
    } else {
        // C'est la source (Source)
        cy.elements().removeClass('path highlighted');
        cy.getElementById(sourceId).addClass('highlighted');
        trajetSourceId = sourceId;
        document.getElementById('connexion-status').textContent = `Statut : Premier utilisateur sélectionné. Cliquez sur un second utilisateur pour trouver le trajet social.`;
    }
};


// --- FONCTION 3 : Masquer/Afficher les serveurs ---
const toggleServers = () => {
    if (!cy) return;

    const servers = cy.nodes('[type = "serveur"]');
    const linksToServers = cy.edges('[type = "membre_de"]');
    const button = document.getElementById('btn-toggle-servers');

    if (serversVisible) {
        // Stocker la position actuelle du graphe des utilisateurs (si l'utilisateur l'a déplacé)
        serversHiddenLayout = cy.json();

        // Cacher les serveurs et les liens de membre
        servers.hide();
        linksToServers.hide();
        
        // Exécuter un nouveau layout sur les nœuds visibles (utilisateurs et liens serveur_commun)
        const newLayout = cy.layout({
            name: 'concentric', 
            fit: true, 
            padding: 50, 
            animate: true, 
            animationDuration: 800,
            ready: function() {
                // Stocker la position de ce layout compact
                serversHiddenLayout = cy.json();
            }
        });
        newLayout.run();
        
        serversVisible = false;
        button.textContent = "Afficher les Serveurs";
        document.getElementById('connexion-status').textContent = "Statut : Les nœuds de serveurs sont masqués.";
    } else {
        // Afficher les serveurs et les liens de membre
        servers.show();
        linksToServers.show();

        // Restaurer la position stockée (si disponible) ou relancer le layout complet
        if (serversHiddenLayout) {
             cy.json(serversHiddenLayout); // Restaure les positions
             cy.layout({ name: 'concentric', fit: true, padding: 30 }).run(); // Un layout doux pour le retour
        } else {
             cy.layout({ name: 'concentric', fit: true, padding: 30 }).run();
        }

        serversVisible = true;
        button.textContent = "Masquer les Serveurs";
        document.getElementById('connexion-status').textContent = "Statut : Les nœuds de serveurs sont affichés.";
    }
};


// --- Fonctions Cytoscape ---

const preparerElementsGraphe = (utilisateurs, relations, serveurs) => {
    // ... (Logique inchangée)
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
            'border-width': 0, // Style par défaut pour le border
        }},
        { selector: 'node[type = "serveur"]', style: {
            'shape': 'round-rectangle', 'width': '80px', 'height': '30px', 'text-halign': 'center', 'text-valign': 'top',
            'font-size': '10px',
        }},
        { selector: 'node:selected', style: {
            'border-width': 3, 'border-color': '#fff', 'border-opacity': 0.7,
            'text-outline-color': '#000', 'text-outline-width': 2,
        }},
        // --- NOUVEAUX STYLES POUR LOCALISATION ET TRAJET ---
        { selector: 'node.highlighted', style: {
            'border-width': 5,
            'border-color': '#ffcc00', /* Jaune vif pour le focus */
            'z-index': 100,
        }},
        { selector: 'edge.path', style: {
            'line-color': '#ffcc00', /* Jaune vif pour le chemin */
            'width': 5,
            'z-index': 90,
        }},
        // ----------------------------------------------------
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
            // layout: (utilisateurs.length > 50 ? { name: 'cola', fit: true, padding: 30 } : { name: 'concentric', fit: true, padding: 30, animate: true, animationDuration: 500 })
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
                cy.elements().removeClass('path highlighted'); // Enlever la sélection/trajet
                trajetSourceId = null; 
            }
        });
        
        serversVisible = true;
        document.getElementById('btn-toggle-servers').textContent = "Masquer les Serveurs";

    } catch (e) { 
        console.error("Erreur lors de l'initialisation de Cytoscape:", e); 
        document.getElementById('connexion-status').textContent = "Statut : Erreur critique d'affichage du graphe.";
    }
};

const detecterRelationsCommunes = () => {
    // ... (Logique inchangée)
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
    // ... (Logique inchangée)
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
    // ... (Logique inchangée)
    const userData = data.userData;
    const guildsData = data.guildsData || []; 
    
    if (!userData) {
        console.error("Données de l'utilisateur invalides.");
        return;
    }
    
    document.getElementById('connexion-status').textContent = `Statut : Connecté en tant que ${userData.global_name || userData.username}. ${guildsData.length} serveurs récupérés.`;
};

// --- FONCTION 4 : Recharger la carte depuis la DB (pour le nouveau bouton) ---
const rechargerCarte = () => {
    importerDonneesStockees(false);
};

const importerDonneesStockees = async (afterCodeGrant = false) => {
    document.getElementById('connexion-status').textContent = "Statut : Chargement et fusion de toutes les cartes sauvegardées (via MongoDB)...";
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
            document.getElementById('connexion-status').textContent = "Statut : Erreur lors de l'importation des cartes stockées (API Down ?).";
        }

    } catch (error) {
        console.error("❌ Erreur de connexion au Proxy Cloud. L'API est-elle déployée et l'URL est-elle correcte ?", error);
        document.getElementById('connexion-status').textContent = "Statut : Échec - API Proxy Cloud non trouvé.";
    }
};

const echangerCodeContreInfos = async (code) => {
    // ... (Logique inchangée)
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
    // ... (Logique inchangée)
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
    if (confirm("Êtes-vous sûr de vouloir vider complètement la carte ? (Cela ne supprime PAS les données dans la base de données)")) {
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
    
    // Ajout des nouveaux écouteurs d'événements
    document.getElementById('btn-reset').addEventListener('click', reinitialiserGraphe);
    document.getElementById('btn-discord-connect').addEventListener('click', connecterDiscord);
    document.getElementById('btn-reload-map').addEventListener('click', rechargerCarte); 
    document.getElementById('btn-toggle-servers').addEventListener('click', toggleServers);

    // Démarrer la gestion de la redirection
    gererRedirectionOAuth();
});
