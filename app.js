 --- INK L2 NETWORK CONFIGURATION (From contract_details.js) ---
const INK_CHAIN_ID = 57073;
const INK_RPC_URL = 'httpsrpc-qnd.inkonchain.com';  Public RPC for the Ink L2 Mainnet

 --- DEPLOYED CONTRACT ADDRESSES (From contract_details.js) ---
const NFT_CONTRACT_ADDRESS = '0xa15B0d8f1Bd0B3426C44F7fF4E67F4756662DDa5';
const BERT_TOKEN_ADDRESS = '0x62c99FAc20B33b5423fdf9226179e973A8353e36';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const MINT_FEE_AMOUNT = 1000;

 --- ABI SNIPPETS (From contract_details.js) ---
const BERT_ABI_SNIPPET = [
    function transfer(address to, uint256 amount) returns (bool),
    function balanceOf(address account) view returns (uint256),
    event Transfer(address indexed from, address indexed to, uint256 value)
];
const NFT_ABI_SNIPPET = [
    function safeMint(address to, string memory uri) public returns (uint256),
    function owner() public view returns (address)
];
const TOKEN_URI_ABI_SNIPPET = [
    function tokenURI(uint256 tokenId) view returns (string)
];
 ----------------------------------------------------

  CONFIRMED BERT TOKEN ADDRESS (Used for balance reading stability) 
const CONFIRMED_BERT_ADDRESS = 0x62c99FAc20B33b5423fdf9226179e973A8353e36;

 --- STATE ---
let currentAccount = null;
let provider = null;  Wallet provider (used for signing)
let signer = null;
let contract = null;  This contract is for WRITING (requires signer)
let pendingTxHash = null; 

 --- HARD-CODED GUARANTEE ---
const GUARANTEED_MINTS = [0xeb85a7dd5e847e2cb32aec12cf13a87ca33900eadd64c0880db8a6a2224e3a00];
let fetchedHashes = new Set(); 
 -----------------------------

 --- ELEMENTS ---
const $ = (id) = document.getElementById(id);
const ui = {
    header $('wallet-bar'),
    address $('address-display'),
    disconnect $('disconnect-btn'),
    balance $('balance-display'),
      Total Burn Display
    totalBurn $('total-burn-display'), 
    input $('inscription-input'),
      Preview Box
    preview $('preview-box'), 
    byteCount $('byte-count'),
    gas $('gas-display'),
    btn $('main-btn'),
    btnText $('btn-text'),
    spinner $('spinner'),
    statusBox $('status-box'),
    statusMsg $('status-msg'),
    manualBtn $('manual-btn'),
    manualInput $('manual-hash'),
    grid $('gallery-grid'),
    loader $('gallery-loader'),
    empty $('gallery-empty'),
    refresh $('refresh-btn')
};

 ============================================================
 1. CORE CONNECTION LOGIC
 ============================================================

async function rebuildConnection(forcedAccount = null) {
    if (typeof window.ethereum === 'undefined') {
        console.warn('No wallet found when rebuilding connection');
        handleDisconnect();
        return;
    }

    try {
          STRICT RE-INITIALIZATION (Wallet Provider for Signing) 
        provider = new window.ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

         --- PRIORITY ADDRESS LOGIC ---
        let definitiveAccount;
        if (forcedAccount) {
            definitiveAccount = forcedAccount;
        } else {
            const accounts = await window.ethereum.request({ method 'eth_accounts' });
            if (accounts && accounts.length  0) {
                definitiveAccount = accounts[0];
            } else {
                handleDisconnect();
                return;
            }
        }
        
         Set the current account state and update the UI
        currentAccount = window.ethers.getAddress(definitiveAccount);
         ---------------------------------------------------

         Recreate contract with the fresh signer (using the address from contract_details for mintingsigning)
        contract = new window.ethers.Contract(BERT_TOKEN_ADDRESS, BERT_ABI_SNIPPET, signer);

         Update UI elements 
        ui.header.classList.remove('hidden');
        ui.address.textContent = currentAccount  'Unknown';

        ui.btn.disabled = false;
        ui.btnText.textContent = `MINT INKSCRIPTION (BURN ${MINT_FEE_AMOUNT} BERT)`;
        ui.spinner.classList.add('hidden');
        ui.btn.classList.remove('btn-primary-loading');

         Fetch live data (uses dedicated readProvider now)
        await fetchBalance();
         When connected, we fetch the gallery here
        await fetchGallery();  -- Ensure gallery loads after successful connection setup
        calcGas();
    } catch (err) {
        console.error('rebuildConnection error', err);
        handleDisconnect();
    }
}

function handleDisconnect() {
    currentAccount = null;
    provider = null;
    signer = null;
    contract = null;
    pendingTxHash = null;
    fetchedHashes.clear(); 
    
     Note Total burn display is now handled by fetchGallery() on init if not connected.

    ui.header.classList.add('hidden');
    ui.balance.textContent = ---;
    ui.btnText.textContent = Connect Wallet;
    ui.btn.disabled = false;
    ui.spinner.classList.add('hidden');
    ui.btn.classList.remove('btn-primary-loading');
    ui.statusBox.classList.add('hidden');
    ui.grid.innerHTML = ''; 
    ui.empty.classList.remove('hidden'); 
}

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        alert(No wallet found. Please install MetaMask or another Web3 wallet.);
        return;
    }
    try {
         Request accounts. This will trigger MetaMask to connectconfirm
        const accounts = await window.ethereum.request({ method 'eth_requestAccounts' });
        if (accounts && accounts.length  0) {
            await rebuildConnection(accounts[0]);
        }
        return accounts;
    } catch (e) {
        console.error('connectWallet error', e);
        if (e.code === 4001) {
            alert('Please connect to your wallet to use this dApp.');
        }
        handleDisconnect(); 
        return [];
    }
}

 ============================================================
 2. EVENT LISTENERS
 ============================================================
if (window.ethereum) {
    window.ethereum.on('accountsChanged', async (accounts) = {
        console.log(Wallet accountsChanged event fired, accounts);
        
         --- SYNCHRONIZATION FIXES ---
        if (window.ethereum.disconnect) {
            try {
                await window.ethereum.disconnect(); 
                console.log(Forced disconnect successful.);
            } catch (e) {
                console.warn(Forced disconnect failed (this is often fine), e);
            }
        }

        if (!accounts  accounts.length === 0) {
            handleDisconnect();
            return;
        }
        
          DELAYED REBUILD FIX 
        setTimeout(async () = {
            await rebuildConnection(accounts[0]);
            console.log(Wallet address updated after 100ms delay.);
        }, 100);
    });

    window.ethereum.on('chainChanged', (chainId) = {
        console.log(Chain changed event fired, chainId);
        window.location.reload();
    });
}

 NOTE Event listeners are attached inside the init function to ensure elements exist.
 ui.btn.addEventListener('click', () = {
     if (!currentAccount) connectWallet();
     else mintInscription();
 });

 ui.disconnect.addEventListener('click', handleDisconnect);

 ============================================================
 3. MINTING (Uses wallet's signer, no change needed)
 ============================================================
async function mintInscription() {
    const text = ui.input.value.trim();
    if (!text) return alert(Please enter text);
    if (!signer  !contract) return alert(Connect wallet first);

    try {
        ui.btn.disabled = true;
        ui.spinner.classList.remove('hidden');
        ui.btn.classList.add('btn-primary-loading');
        ui.btnText.textContent = Sign in Wallet...;
        ui.statusBox.classList.add('hidden');
        pendingTxHash = null; 

        const amount = window.ethers.parseUnits(MINT_FEE_AMOUNT.toString(), 18);
        const json = JSON.stringify({ text text });
        const hexData = window.ethers.hexlify(window.ethers.toUtf8Bytes(json)).slice(2);
        const calldata = contract.interface.encodeFunctionData(transfer, [BURN_ADDRESS, amount]);

        const tx = await signer.sendTransaction({
            to BERT_TOKEN_ADDRESS,
            data calldata + hexData,
            value 0
        });

        ui.btnText.textContent = Minting...;
        pendingTxHash = tx.hash;

         Index is unknown for a pending transaction
        createGalleryCard(text, tx.hash, Pending..., true, '---'); 
        ui.empty.classList.add('hidden');

        ui.statusMsg.textContent = `⏳ TRANSACTION PENDINGnHash ${tx.hash}`;
        ui.statusBox.classList.remove('hidden');

        await tx.wait();

        ui.statusMsg.textContent = `✅ TRANSACTION CONFIRMED!nHash ${tx.hash}`;
        
        await fetchBalance();
        await fetchGallery(); 

        ui.btn.disabled = false;
        ui.spinner.classList.add('hidden');
        ui.btn.classList.remove('btn-primary-loading');
        ui.btnText.textContent = `MINT INKSCRIPTION (BURN ${MINT_FEE_AMOUNT} BERT)`;
        
        ui.input.value = '';
        calcGas();

    } catch (e) {
        console.error('Minting Error', e);
        
        if (pendingTxHash) removeGalleryCard(pendingTxHash);
        
        ui.btn.disabled = false;
        ui.spinner.classList.add('hidden');
        ui.btn.classList.remove('btn-primary-loading');
        ui.btnText.textContent = `MINT INSCRIPTION (${MINT_FEE_AMOUNT} BERT)`;

        let msg = e.reason  e.message  Unknown Error;
        if (typeof msg === 'string' && msg.includes(insufficient)) msg = Insufficient BERT Token Funds or Gas;
        ui.statusMsg.textContent = `❌ ${msg}`;
        ui.statusBox.classList.remove('hidden');
    } finally {
        pendingTxHash = null;
    }
}

 ============================================================
 4. GALLERY LOGIC (MODIFIED FOR STABLE JSON RPC PROVIDER)
 ============================================================
 ui.refresh.addEventListener('click', fetchGallery);

async function fetchGallery() {
    const readProvider = new window.ethers.JsonRpcProvider(INK_RPC_URL);
    if (!readProvider) return; 
    
    ui.loader.classList.remove('hidden');

    try {
        const currentBlock = await readProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 5000); 
        
        const stableContract = new window.ethers.Contract(BERT_TOKEN_ADDRESS, BERT_ABI_SNIPPET, readProvider);
        const filter = stableContract.filters.Transfer(null, BURN_ADDRESS); 
        
        const events = await stableContract.queryFilter(filter, fromBlock, currentBlock);
        
          CALCULATE AND DISPLAY BURN METRIC 
        const totalInscriptions = events.length + GUARANTEED_MINTS.length;
        let inscriptionCounter = totalInscriptions;
        
         CALCULATE TOTAL BURNED
        const totalBurned = totalInscriptions  MINT_FEE_AMOUNT;
        
          UPDATE TEXT FORMAT AND CONTENT (Red, Graffiti font, Fire emoji added)
        ui.totalBurn.textContent = `${totalBurned.toLocaleString()} BERT 🔥`;
         ------------------------------------------

        if (pendingTxHash) removeGalleryCard(pendingTxHash);

        ui.grid.innerHTML = '';
        fetchedHashes.clear();
        
          PROMISE.ALL MODIFICATION 
        const renderPromises = [];

         1. Re-add guaranteed mints
        for(const hash of GUARANTEED_MINTS) {
             Collect promise
            renderPromises.push(decodeAndRenderTx(hash, true, readProvider, inscriptionCounter--));
        }
        
         2. Add new events
        for (const evt of events.reverse()) {
             Collect promise
            renderPromises.push(decodeEvent(evt, true, readProvider, inscriptionCounter--)); 
        }
        
          AWAIT ALL RENDERING PROMISES before updating UI 
        await Promise.all(renderPromises);

        if (ui.grid.children.length === 0) {
            ui.empty.classList.remove('hidden');
        } else {
            ui.empty.classList.add('hidden');
        }

    } catch (e) {
        console.error('fetchGallery error', e);
         Set to 0 on failure to avoid confusion
        ui.totalBurn.textContent = `0 BERT 🔥`; 
    } finally {
         This ensures the loader is hidden upon completion, regardless of successfailure
        ui.loader.classList.add('hidden'); 
    }
}

  MODIFIED to return the promiseresult of the rendering task 
async function decodeAndRenderTx(hash, prepend = false, currentProvider = null, index = '---') {
    const p = currentProvider  provider;
     if (!p  fetchedHashes.has(hash)) return;

     try {
        const tx = await p.getTransaction(hash);
        if(tx && tx.data && tx.data.length  138) {
            const raw = 0x + tx.data.slice(138); 
            let str = ;
            try {
                str = window.ethers.toUtf8String(raw);
            } catch (err) {
                return;
            }
            let content = str;
            try { content = JSON.parse(str).text; } catch(e){}
            
            createGalleryCard(content, tx.hash, tx.blockNumber  '---', prepend, index);  Pass index here
            fetchedHashes.add(tx.hash);
            return true;  Return a success indicator
        }
    } catch (e) {
        console.warn(Could not decode TX for hash, hash, e);
    }
    return false;
}

  MODIFIED to return the promiseresult of the rendering task 
async function decodeEvent(evt, prepend = false, currentProvider = null, index = '---') {
    if (!evt.transactionHash  fetchedHashes.has(evt.transactionHash)) return;
    
    return decodeAndRenderTx(evt.transactionHash, prepend, currentProvider, index);  Return the promise
}

function removeGalleryCard(hash) {
    const card = document.getElementById(`card-${hash}`);
    if (card) card.remove();
}

  MODIFIED to accept and display index parameter and include new view button 
function createGalleryCard(art, hash, block, prepend = false, index = '---') {
    const safeArt = (art  ).replace(g, &lt;).replace(g, &gt;);
    const isPending = block === Pending...;
    const badge = isPending  bg-yellow-100 text-yellow-800  bg-gray-100 text-gray-600;
    
     --- NEW Store content in a global cache keyed by hash ---
    window.tempInscriptionContent[hash] = art; 
     --------------------------------------------------------

    removeGalleryCard(hash); 

    const div = document.createElement('div');
    div.id = `card-${hash}`; 
     Added card-hover class
    div.className = `bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col animate-fade-in ${isPending  'pending-card'  ''} card-hover`; 
    div.innerHTML = `
        div class=bg-gray-900 text-purple-400 p-4 rounded text-xs overflow-auto ascii-art mb-3 flex-grow style=max-height 300px;${safeArt}div
        
        div class=text-xl font-extrabold text-violet-500 mb-2#${index}div 
        
        div class=pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 mb-2
            span class=px-2 py-1 rounded ${badge}Block ${block}span
            a href=httpsexplorer.inkonchain.comtx${hash} target=_blank class=text-blue-500 hoverunderlineView TX ↗a
        div
        button onclick=viewFullInscription('${hash}') 
                class=w-full bg-violet-600 hoverbg-violet-700 text-white text-xs font-bold py-1 px-2 rounded transition mt-2
            View Full Content
        button
    `;
    
    if (prepend) ui.grid.prepend(div); 
    else ui.grid.appendChild(div);
}

 ============================================================
 5. UTILS (MODIFIED FOR STABLE JSON RPC PROVIDER)
 ============================================================
async function fetchBalance() {
    const readProvider = new window.ethers.JsonRpcProvider(INK_RPC_URL);

    if(!readProvider  !currentAccount) { 
         ui.balance.textContent = ---;
         return;
    }
    try {
        const stableReadContract = new window.ethers.Contract(CONFIRMED_BERT_ADDRESS, BERT_ABI_SNIPPET, readProvider);
        const bal = await stableReadContract.balanceOf(currentAccount);
        
        if (bal === undefined  bal === null) {
            ui.balance.textContent = NA BERT;
            return;
        }

        const formattedBalance = parseFloat(window.ethers.formatUnits(bal, 18)).toFixed(2);
        
        if (formattedBalance === 0.00) {
            ui.balance.textContent = 0.00 BERT;
        } else {
            ui.balance.textContent = formattedBalance +  BERT;
        }
    } catch(e){
        console.error('fetchBalance failed', e);
        ui.balance.textContent = ---; 
    }
}

 ui.input.addEventListener('input', calcGas);
async function calcGas() {
    const readProvider = new window.ethers.JsonRpcProvider(INK_RPC_URL);
    const txt = ui.input.value  ;
    const bytes = new TextEncoder().encode(txt);
    
    ui.byteCount.textContent = bytes.length;
    
     --- PREVIEW LOGIC ---
    if (txt.length  0) {
        const safeHtml = txt.replace(g, &lt;).replace(g, &gt;);
        ui.preview.innerHTML = safeHtml;
        ui.preview.classList.remove('hidden');
    } else {
        ui.preview.classList.add('hidden');
        ui.preview.innerHTML = '';
    }
     -------------------------

     Cannot estimate gas without a providernetwork connection
    if(!readProvider) {
        ui.gas.textContent = `---`;
        return;
    }

      FIX Show a placeholder if input is empty, and only attempt estimation when content exists 
    if (txt.length === 0) {
        ui.gas.textContent = `(Start Typing)`;
        return;
    }
    
    try {
         1. Construct the transaction data object
        const amount = window.ethers.parseUnits(MINT_FEE_AMOUNT.toString(), 18);
         We use a minimal payload for estimation, but still need the structure
        const json = JSON.stringify({ text txt });
        const hexData = window.ethers.hexlify(window.ethers.toUtf8Bytes(json)).slice(2);
        
         Need a Contract instance to encode the calldata
        const tempContract = new window.ethers.Contract(BERT_TOKEN_ADDRESS, BERT_ABI_SNIPPET, readProvider);
        const calldata = tempContract.interface.encodeFunctionData(transfer, [BURN_ADDRESS, amount]);
        
         IMPORTANT Since we don't have a signercurrentAccount available here for `from`,
         the estimation might fail if the provider is strict. To fix this, we'll
         use a fallback logic in case the estimation fails.
        
        const txData = {
            to BERT_TOKEN_ADDRESS,
            data calldata + hexData,
            value 0
        };

         2. Estimate the Gas Limit
        const gasLimit = await readProvider.estimateGas(txData);

         3. Get the current Gas Price (Fee Data)
        const feeData = await readProvider.getFeeData();
        const gasPrice = feeData.maxFeePerGas  feeData.gasPrice  BigInt(0);
        
         4. Calculate the total ETH cost
        const cost = gasLimit  gasPrice; 
        ui.gas.textContent = `~${parseFloat(window.ethers.formatEther(cost)).toFixed(6)} ETH`;

    } catch (err) {
         Fallback If live estimation fails (e.g., RPC issues, simulation error),
         revert to a simpler estimation using a hardcoded gas limit approximation
         based on the data size, which is better than a generic error message.
        console.warn(Live Gas estimation failed, falling back to approximation, err);
        
        const approxGas = BigInt(65000) + BigInt(bytes.length  16); 

        try {
            const feeData = await readProvider.getFeeData();
            const gasPrice = feeData.maxFeePerGas  feeData.gasPrice  BigInt(0);
            const cost = approxGas  gasPrice; 
            ui.gas.textContent = `~${parseFloat(window.ethers.formatEther(cost)).toFixed(6)} ETH (approx)`;
        } catch (innerErr) {
            ui.gas.textContent = `ErrorHigh Fee`;
        }
    }
}

ui.manualBtn.addEventListener('click', async () = {
    const hash = ui.manualInput.value.trim();
    
    const readProvider = new window.ethers.JsonRpcProvider(INK_RPC_URL);
    if(!hash  !readProvider) return alert(Connect wallet or network issue.);
    
    ui.manualBtn.textContent = Searching...;
    
    try {
         Pass '---' for the index as it's an external hash lookup
        await decodeAndRenderTx(hash, true, readProvider, '---'); 
        
        if (ui.grid.children.length  0) {
             ui.empty.classList.add('hidden');
        } else {
             alert(Transaction found, but no valid inscription data (transfer to burn address with payload).);
        }
    } catch(e) { 
        console.error(e);
        alert(Transaction not found or provider error.); 
    }
    
    ui.manualBtn.textContent = Look Up; 
});


 ============================================================
 6. INIT check connected accounts on load
 ============================================================
(async function init() {
     Add event listeners here now that the DOM is loaded
    ui.btn.addEventListener('click', () = {
        if (!currentAccount) connectWallet();
        else mintInscription();
    });
    ui.disconnect.addEventListener('click', handleDisconnect);
    ui.refresh.addEventListener('click', fetchGallery);
    ui.input.addEventListener('input', calcGas);
    
    if (window.ethereum) {
        try {
            const acc = await window.ethereum.request({ method 'eth_accounts' });
            
            if (acc && acc.length  0) {
                await rebuildConnection(acc[0]);
            } else {
                 FALLBACK If wallet is installed but not connected, load the gallery anyway
                await fetchGallery(); 
            }
        } catch (err) {
            console.error('init eth_accounts error', err);
            ui.loader.classList.add('hidden'); 
             FALLBACK If eth_accounts fails for any reason, load the gallery anyway
            await fetchGallery(); 
        }
    } else {
        handleDisconnect();
         FALLBACK If no wallet is installed, load the gallery to show burned history
        await fetchGallery();
    }
})();