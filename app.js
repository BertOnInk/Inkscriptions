// --- INK L2 NETWORK CONFIGURATION (From contract_details.js) ---
const INK_CHAIN_ID = 57073;
const INK_RPC_URL = 'https://rpc-qnd.inkonchain.com'; // Public RPC for the Ink L2 Mainnet

// --- DEPLOYED CONTRACT ADDRESSES (From contract_details.js) --
const NFT_CONTRACT_ADDRESS = '0xa15B0d8f1Bd0B3426C44F7fF4E67F4756662DDa5';
const BERT_TOKEN_ADDRESS = '0x62c99FAc20B33b5423fdf9226179e973A8353e36';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const MINT_FEE_AMOUNT = 1000;

// --- ABI SNIPPETS (From contract_details.js) ---
const BERT_ABI_SNIPPET = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];
const NFT_ABI_SNIPPET = [
    "function safeMint(address to, string memory uri) public returns (uint256)",
    "function owner() public view returns (address)"
];
const TOKEN_URI_ABI_SNIPPET = [
    "function tokenURI(uint256 tokenId) view returns (string)"
];
// ----------------------------------------------------

// *** CONFIRMED BERT TOKEN ADDRESS ***
const CONFIRMED_BERT_ADDRESS = "0x62c99FAc20B33b5423fdf9226179e973A8353e36";

// --- STATE ---
let currentAccount = null;
let provider = null; // Ethers.js Provider (for signing/reading)
let signer = null;
let contract = null; // Ethers.js Contract for BERT (requires signer)
let pendingTxHash = null; 
// --- WALLETCONNECT STATE ---
let web3Modal = null;
let wcProvider = null; 
// -----------------------------

// --- HARD-CODED GUARANTEE ---
const GUARANTEED_MINTS = ["0xeb85a7dd5e847e2cb32aec12cf13a87ca33900eadd64c0880db8a6a2224e3a00"];
let fetchedHashes = new Set(); 

// --- ELEMENTS ---
const $ = (id) => document.getElementById(id);
const ui = {
    header: $('wallet-bar'),
    address: $('address-display'),
    disconnect: $('disconnect-btn'),
    balance: $('balance-display'),
    totalBurn: $('total-burn-display'), 
    input: $('inscription-input'),
    preview: $('preview-box'), 
    byteCount: $('byte-count'),
    gas: $('gas-display'),
    btn: $('main-btn'),
    btnText: $('btn-text'),
    spinner: $('spinner'),
    statusBox: $('status-box'),
    statusMsg: $('status-msg'),
    manualBtn: $('manual-btn'),
    manualInput: $('manual-hash'),
    grid: $('gallery-grid'),
    loader: $('gallery-loader'),
    empty: $('gallery-empty'),
    refresh: $('refresh-btn')
};

// ============================================================
// 1. CORE CONNECTION LOGIC (WALLETCONNECT)
// ============================================================

async function initializeWeb3Modal() {
    // ⚠️ CRITICAL: Project ID confirmed by user
    const projectId = '02fb0ffeebf68d3d73bc0c35fa24e970'; 
    
    // --- Defensive Chain ID Conversion ---
    const INK_CHAIN_ID_HEX = '0x' + INK_CHAIN_ID.toString(16);

    // --- CRITICAL FIX: Defined L2 chain with full EIP155 namespace and currency object for Web3Modal V2 ---
    const inkL2 = {
        chainId: INK_CHAIN_ID, // Decimal ID for Ethers
        chainNamespace: 'eip155', // Explicitly defines it as an EVM chain
        name: 'Ink L2',
        currency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18,
        },
        explorerUrl: 'https://explorer.inkonchain.com',
        rpcUrl: INK_RPC_URL
    };
    // ----------------------------------------------------------------------------------------------------

    if (typeof window.Web3Modal === 'undefined' || typeof window.ethers === 'undefined') {
        console.error('WalletConnect or Ethers.js library not loaded. Check index.html CDNs.');
        // If the libraries are not found, the alert will fire.
        return; 
    }
    
    // Check if the projectId is valid, otherwise Web3Modal might fail silently
    if (!projectId || projectId === 'YOUR_PROJECT_ID') {
        console.error('WalletConnect Project ID is missing or invalid.');
        // If we can't initialize, we return, which will cause 'connectWallet' to alert.
        return; 
    }
    
    try {
        // Defensive initialization using the hexadecimal Chain ID where possible
        web3Modal = new window.Web3Modal.Web3Modal({
            ethersConfig: window.Web3Modal.EthersConfig,
            // Using Hex Chain ID in the main config for maximum compatibility
            chainId: INK_CHAIN_ID_HEX, 
            projectId,
            metadata: {
                name: "Bert's Inkscriptions",
                description: 'Permanent artifacts inked on chain.',
                url: window.location.origin,
                icons: ['https://placehold.co/60x60/8A2BE2/ffffff?text=🐔'] 
            },
            chains: [inkL2]
        });
        
        console.log("WalletConnect Web3Modal initialized successfully.");

    } catch (initError) {
        console.error("WalletConnect initialization failed during Web3Modal creation:", initError);
        // Ensure web3Modal is null if initialization failed
        web3Modal = null; 
    }
}


async function rebuildConnection(connectedProvider = null) {
    if (typeof window.ethers === 'undefined') {
        handleDisconnect();
        return;
    }
    
    // Use the connected provider from WalletConnect
    wcProvider = connectedProvider || wcProvider;
    if (!wcProvider) {
        handleDisconnect();
        return;
    }

    try {
        // 1. Get Ethers Provider and Signer from WalletConnect Provider
        // WalletConnect provides a standard EIP-1193 compatible provider instance
        provider = new window.ethers.BrowserProvider(wcProvider);
        signer = await provider.getSigner();
        
        // 2. Get Account Address
        currentAccount = window.ethers.getAddress(await signer.getAddress());

        // 3. Recreate contract with the fresh signer (for writing)
        contract = new window.ethers.Contract(BERT_TOKEN_ADDRESS, BERT_ABI_SNIPPET, signer);

        // 4. Update UI elements 
        ui.header.classList.remove('hidden');
        ui.address.textContent = currentAccount || 'Unknown';

        ui.btn.disabled = false;
        ui.btnText.textContent = `MINT INKSCRIPTION (BURN ${MINT_FEE_AMOUNT} BERT)`;
        ui.spinner.classList.add('hidden');
        ui.btn.classList.remove('btn-primary-loading');

        // 5. Fetch live data and gallery
        await fetchBalance();
        await fetchGallery(); 
        calcGas();

        // 6. Set up listeners for WalletConnect events (cleanup previous listeners first)
        // WalletConnect provider handles event management
        wcProvider.removeAllListeners(); 
        wcProvider.on('accountsChanged', handleAccountsChanged);
        wcProvider.on('chainChanged', handleChainChanged);
        wcProvider.on('disconnect', handleDisconnect);
        
        console.log("Wallet connection successful:", currentAccount);

    } catch (err) {
        console.error('rebuildConnection error:', err);
        handleDisconnect();
    }
}

function handleDisconnect() {
    // Attempt to close the WC session if one exists
    if (web3Modal && wcProvider) {
        // Use the proper method to disconnect from the modal instance
        if (web3Modal.disconnect) { 
            web3Modal.disconnect();
        }
    }
    
    currentAccount = null;
    provider = null;
    signer = null;
    contract = null;
    pendingTxHash = null;
    fetchedHashes.clear(); 
    wcProvider = null; 
    
    ui.header.classList.add('hidden');
    ui.balance.textContent = "---";
    ui.btnText.textContent = "Connect Wallet";
    ui.btn.disabled = false;
    ui.spinner.classList.add('hidden');
    ui.btn.classList.remove('btn-primary-loading');
    ui.statusBox.classList.add('hidden');
    ui.grid.innerHTML = ''; 
    ui.empty.classList.remove('hidden'); 
}

// WalletConnect event handlers
async function handleAccountsChanged(accounts) {
    console.log("WalletConnect accountsChanged event fired:", accounts);
    if (!accounts || accounts.length === 0) {
        handleDisconnect();
        return;
    }
    // WalletConnect provider should automatically switch if the wallet changes accounts
    await rebuildConnection(); 
}

function handleChainChanged(chainId) {
    console.log("WalletConnect chainChanged event fired:", chainId);
    // Force reload if chain changes (standard practice)
    window.location.reload();
}

async function connectWallet() {
    if (!web3Modal) {
        // If web3Modal is null, the initializeWeb3Modal() function failed or returned early
        alert('WalletConnect not initialized. Please check console for errors.');
        return;
    }
    
    // --- CRITICAL LOGGING ADDITION ---
    console.log('Attempting to open WalletConnect modal...');

    try {
        // This opens the modal for the user to connect
        const providerInstance = await web3Modal.open();
        
        console.log('WalletConnect Modal Opened, Provider Instance Received:', providerInstance);

        if (providerInstance) {
            await rebuildConnection(providerInstance);
        }

    } catch (e) {
        // *** THIS CATCH BLOCK IS WHERE YOUR SILENT ERROR IS LIKELY HIDING ***
        console.error('CONNECT WALLET FAILED:', e);
        
        let errorMsg = 'Failed to connect. Check console for details. ';

        if (e.message && e.message.includes("User rejected")) {
             errorMsg = "Connection cancelled by user.";
        } else if (e.message && (e.message.includes("Invalid network") || e.message.includes("relay"))) {
             errorMsg += "Network or WalletConnect Relay connection failure.";
        } else {
             // If we have a generic failure, alert the message from the error object
             errorMsg += e.message || "Unknown error occurred.";
        }
        
        alert(errorMsg);
        handleDisconnect(); 
    }
}

// ============================================================
// 3. MINTING (BERT BURN WITH AGGRESSIVE CSP BYPASS)
// ============================================================
async function mintInscription() {
    const text = ui.input.value.trim();
    if (!text) return alert("Please enter text");
    if (!signer || !contract) return alert("Connect wallet first");

    try {
        ui.btn.disabled = true;
        ui.spinner.classList.remove('hidden');
        ui.btn.classList.add('btn-primary-loading');
        ui.btnText.textContent = "Sign in Wallet...";
        ui.statusBox.classList.add('hidden');
        pendingTxHash = null; 

        const amount = window.ethers.parseUnits(MINT_FEE_AMOUNT.toString(), 18);
        const json = JSON.stringify({ text: text });
        // Ethers v6 requires slice(2) to remove the '0x' prefix when concatenating
        const inscriptionHexData = window.ethers.hexlify(window.ethers.toUtf8Bytes(json)).slice(2);
        
        // Manual encoding to bypass potential Ethers/Wallet conflict
        const fragment = window.ethers.FunctionFragment.from({
             name: "transfer",
             inputs: [{ type: "address" }, { type: "uint256" }],
             outputs: [{ type: "bool" }]
        });
        const calldata = window.ethers.AbiCoder.defaultAbiCoder().encodeFunctionData(fragment, [BURN_ADDRESS, amount]);
        const finalData = calldata + inscriptionHexData;

        // WalletConnect routes this raw transaction via its relay, bypassing browser CSP
        const tx = await signer.sendTransaction({
            to: BERT_TOKEN_ADDRESS,
            data: finalData,
            value: 0
        });

        ui.btnText.textContent = "Minting...";
        pendingTxHash = tx.hash;

        // Index is unknown for a pending transaction
        createGalleryCard(text, tx.hash, "Pending...", true, '---'); 
        ui.empty.classList.add('hidden');

        ui.statusMsg.textContent = `⏳ TRANSACTION PENDING\nHash: ${tx.hash}`;
        ui.statusBox.classList.remove('hidden');

        await tx.wait();

        ui.statusMsg.textContent = `✅ TRANSACTION CONFIRMED!\nHash: ${tx.hash}`;
        
        await fetchBalance();
        await fetchGallery(); 

        ui.btn.disabled = false;
        ui.spinner.classList.add('hidden');
        ui.btn.classList.remove('btn-primary-loading');
        ui.btnText.textContent = `MINT INKSCRIPTION (BURN ${MINT_FEE_AMOUNT} BERT)`;
        
        ui.input.value = '';
        calcGas();

    } catch (e) {
        console.error('Minting Error:', e);
        
        if (pendingTxHash) removeGalleryCard(pendingTxHash);
        
        ui.btn.disabled = false;
        ui.spinner.classList.add('hidden');
        ui.btn.classList.remove('btn-primary-loading');
        ui.btnText.textContent = `MINT INKSCRIPTION (BURN ${MINT_FEE_AMOUNT} BERT)`;

        let msg = e.reason || e.message || "Unknown Error";
        if (typeof msg === 'string' && msg.includes("insufficient")) msg = "Insufficient BERT Token Funds or Gas";
        
        ui.statusMsg.textContent = `❌ ${msg}`;
        ui.statusBox.classList.remove('hidden');
    } finally {
        pendingTxHash = null;
    }
}

// ============================================================
// 4. GALLERY LOGIC 
// ============================================================

async function fetchGallery() {
    if (typeof window.ethers === 'undefined') return;

    const readProvider = new window.ethers.JsonRpcProvider(INK_RPC_URL);
    if (!readProvider) return; 
    
    ui.loader.classList.remove('hidden');

    try {
        const currentBlock = await readProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 5000); 
        
        const stableContract = new window.ethers.Contract(BERT_TOKEN_ADDRESS, BERT_ABI_SNIPPET, readProvider);
        const filter = stableContract.filters.Transfer(null, BURN_ADDRESS); 
        
const events = await stableContract.queryFilter(filter, fromBlock, currentBlock);
        
        const totalInscriptions = events.length + GUARANTEED_MINTS.length;
        let inscriptionCounter = totalInscriptions;
        
        const totalBurned = totalInscriptions * MINT_FEE_AMOUNT;
        
        ui.totalBurn.textContent = `${totalBurned.toLocaleString()} BERT 🔥`;

        if (pendingTxHash) removeGalleryCard(pendingTxHash);

        ui.grid.innerHTML = '';
        fetchedHashes.clear();
        
        const renderPromises = [];

        for(const hash of GUARANTEED_MINTS) {
            renderPromises.push(decodeAndRenderTx(hash, true, readProvider, inscriptionCounter--));
        }
        
        for (const evt of events.reverse()) {
            renderPromises.push(decodeEvent(evt, true, readProvider, inscriptionCounter--)); 
        }
        
        await Promise.all(renderPromises);

        if (ui.grid.children.length === 0) {
            ui.empty.classList.remove('hidden');
        } else {
            ui.empty.classList.add('hidden');
        }

    } catch (e) {
        console.error('fetchGallery error:', e);
        ui.totalBurn.textContent = `0 BERT 🔥`; 
    } finally {
        ui.loader.classList.add('hidden'); 
    }
}

async function decodeAndRenderTx(hash, prepend = false, currentProvider = null, index = '---') {
    const p = currentProvider || provider;
     if (!p || fetchedHashes.has(hash)) return;

     try {
        const tx = await p.getTransaction(hash);
        if(tx && tx.to && tx.to.toLowerCase() === BERT_TOKEN_ADDRESS.toLowerCase() && tx.data && tx.data.length > 138) {
            const raw = "0x" + tx.data.slice(138); 
            let str = "";
            try {
                str = window.ethers.toUtf8String(raw);
            } catch (err) {
                return;
            }
            let content = str;
            try { content = JSON.parse(str).text; } catch(e){}
            
            createGalleryCard(content, tx.hash, tx.blockNumber || '---', prepend, index);
            fetchedHashes.add(tx.hash);
            return true; 
        }
    } catch (e) {
        console.warn("Could not decode TX for hash:", hash, e);
    }
    return false;
}

async function decodeEvent(evt, prepend = false, currentProvider = null, index = '---') {
    if (!evt.transactionHash || fetchedHashes.has(evt.transactionHash)) return;
    
    return decodeAndRenderTx(evt.transactionHash, prepend, currentProvider, index); 
}

function removeGalleryCard(hash) {
    const card = document.getElementById(`card-${hash}`);
    if (card) card.remove();
}

function createGalleryCard(art, hash, block, prepend = false, index = '---') {
    const safeArt = (art || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const isPending = block === "Pending...";
    const badge = isPending ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-600";
    
    window.tempInscriptionContent[hash] = art; 

    removeGalleryCard(hash); 

    const div = document.createElement('div');
    div.id = `card-${hash}`; 
    div.className = `bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col animate-fade-in ${isPending ? 'pending-card' : ''} card-hover`; 
    div.innerHTML = `
        <div class="bg-gray-900 text-purple-400 p-4 rounded text-xs overflow-auto ascii-art mb-3 flex-grow" style="max-height: 300px;">${safeArt}</div>
        
        <div class="text-xl font-extrabold text-violet-500 mb-2">#${index}</div> 
        
        <div class="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 mb-2">
            <span class="px-2 py-1 rounded ${badge}">Block: ${block}</span>
            <a href="https://explorer.inkonchain.com/tx/${hash}" target="_blank" class="text-blue-500 hover:underline">View TX ↗</a>
        </div>
        <button onclick="viewFullInscription('${hash}')" 
                class="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold py-1 px-2 rounded transition mt-2">
            View Full Content
        </button>
    `;
    
    if (prepend) ui.grid.prepend(div); 
    else ui.grid.appendChild(div);
}

// ============================================================
// 5. UTILS 
// ============================================================
async function fetchBalance() {
    if (typeof window.ethers === 'undefined') return;

    const readProvider = new window.ethers.JsonRpcProvider(INK_RPC_URL);

    if(!readProvider || !currentAccount) { 
         ui.balance.textContent = "---";
         return;
    }
    try {
        const stableReadContract = new window.ethers.Contract(CONFIRMED_BERT_ADDRESS, BERT_ABI_SNIPPET, readProvider);
        const bal = await stableReadContract.balanceOf(currentAccount);
        
        if (bal === undefined || bal === null) {
            ui.balance.textContent = "N/A BERT";
            return;
        }

        const formattedBalance = parseFloat(window.ethers.formatUnits(bal, 18)).toFixed(2);
        
        if (formattedBalance === "0.00") {
            ui.balance.textContent = "0.00 BERT";
        } else {
            ui.balance.textContent = formattedBalance + " BERT";
        }
    } catch(e){
        console.error('fetchBalance failed:', e);
        ui.balance.textContent = "---"; 
    }
}

async function calcGas() {
    if (typeof window.ethers === 'undefined') return;
    
    const readProvider = new window.ethers.JsonRpcProvider(INK_RPC_URL);
    const txt = ui.input.value || "";
    const bytes = new TextEncoder().encode(txt);
    
    ui.byteCount.textContent = bytes.length;
    
    if (txt.length > 0) {
        const safeHtml = txt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        ui.preview.innerHTML = safeHtml;
        ui.preview.classList.remove('hidden');
    } else {
        ui.preview.classList.add('hidden');
        ui.preview.innerHTML = '';
    }

    if(!readProvider) {
        ui.gas.textContent = `---`;
        return;
    }

    if (txt.length === 0) {
        ui.gas.textContent = `(Start Typing)`;
        return;
    }
    
    try {
        // 1. Construct the transaction data object using manual encoding for estimation
        const amount = window.ethers.parseUnits(MINT_FEE_AMOUNT.toString(), 18);
        const json = JSON.stringify({ text: txt });
        const inscriptionHexData = window.ethers.hexlify(window.ethers.toUtf8Bytes(json)).slice(2);
        
        const fragment = window.ethers.FunctionFragment.from({
             name: "transfer",
             inputs: [{ type: "address" }, { type: "uint256" }],
             outputs: [{ type: "bool" }]
        });
        const calldata = window.ethers.AbiCoder.defaultAbiCoder().encodeFunctionData(fragment, [BURN_ADDRESS, amount]);
        const finalData = calldata + inscriptionHexData;
        
        const txData = {
            to: BERT_TOKEN_ADDRESS,
            data: finalData,
            value: 0
        };

        // 2. Estimate the Gas Limit
        const gasLimit = await readProvider.estimateGas(txData);

        // 3. Get the current Gas Price (Fee Data)
        const feeData = await readProvider.getFeeData();
        const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || BigInt(0);
        
        // 4. Calculate the total ETH cost
        const cost = gasLimit * gasPrice; 
        ui.gas.textContent = `~${parseFloat(window.ethers.formatEther(cost)).toFixed(6)} ETH`;

    } catch (err) {
        console.warn("Live Gas estimation failed, falling back to approximation:", err);
        
        const approxGas = BigInt(65000) + BigInt(bytes.length * 16); 

        try {
            const feeData = await readProvider.getFeeData();
            const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || BigInt(0);
            const cost = approxGas * gasPrice; 
            ui.gas.textContent = `~${parseFloat(window.ethers.formatEther(cost)).toFixed(6)} ETH (approx)`;
        } catch (innerErr) {
            ui.gas.textContent = `Error/High Fee`;
        }
    }
}

async function manualLookUp() {
    if (typeof window.ethers === 'undefined') return;
    
    const hash = ui.manualInput.value.trim();
    
    const readProvider = new window.ethers.JsonRpcProvider(INK_RPC_URL);
    if(!hash || !readProvider) return alert("Connect wallet or network issue.");
    
    ui.manualBtn.textContent = "Searching...";
    
    try {
        const result = await decodeAndRenderTx(hash, true, readProvider, '---'); 
        
        if (ui.grid.children.length > 0 && result) {
             ui.empty.classList.add('hidden');
        } else {
             alert("Transaction not found or valid inscription data (transfer to burn address with payload).");
        }
    } catch(e) { 
        console.error(e);
        alert("Transaction not found or provider error."); 
    }
    
    ui.manualBtn.textContent = "Look Up"; 
}


// ============================================================
// 6. GLOBAL INIT FUNCTION (WALLETCONNECT INIT)
// ============================================================
// Renamed function and removed 'window.' for better scoping
const startApp = async function() {
    
    // --- Initialize WalletConnect Web3Modal ---
    await initializeWeb3Modal();

    // Add event listeners here now that the DOM is guaranteed to be loaded
    ui.btn.addEventListener('click', () => {
        if (!currentAccount) connectWallet();
        else mintInscription();
    });
    ui.disconnect.addEventListener('click', handleDisconnect);
    ui.refresh.addEventListener('click', fetchGallery);
    ui.input.addEventListener('input', calcGas);
    ui.manualBtn.addEventListener('click', manualLookUp); 
    
    // Attempt to auto-reconnect using Web3Modal's internal state
    if (web3Modal && web3Modal.provider) {
        await rebuildConnection(web3Modal.provider);
    } else {
        // FALLBACK: Load the gallery if not connected
        await fetchGallery();
    }
};

// FIX: Execute the startApp function immediately upon script load.
startApp();