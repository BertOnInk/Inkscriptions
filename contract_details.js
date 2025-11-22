// --- INK L2 NETWORK CONFIGURATION ---
const INK_CHAIN_ID = 57073;
const INK_RPC_URL = 'https://rpc-qnd.inkonchain.com'; // Public RPC for the Ink L2 Mainnet

// --- DEPLOYED CONTRACT ADDRESSES ---
// The NFT contract you deployed and verified. This contract holds the 'safeMint' function.
const NFT_CONTRACT_ADDRESS = '0xa15B0d8f1Bd0B3426C44F7fF4E67F4756662DDa5';

// The BERT token contract address (used as the fee token).
const BERT_TOKEN_ADDRESS = '0x62c99FAc20B33b5423fdf9226179e973A8353e36';

// The address where the BERT fee will be sent (burned).
// We use the zero address plus a common hex tag to signify the destination (0x...dEaD).
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

// --- APPLICATION CONFIGURATION ---
// The amount of BERT required for a single inscription mint.
const MINT_FEE_AMOUNT = 1000;

// --- ABI SNIPPETS (FIXED FOR STABILITY) ---
// ABI for the BERT token (ERC-20 functions)
const BERT_ABI_SNIPPET = [
    // Function for sending tokens (WRITE operation)
    "function transfer(address to, uint256 amount) returns (bool)",
    
    // Function for reading the balance (READ operation - CRUCIAL FIX)
    "function balanceOf(address account) view returns (uint256)",
    
    // The Transfer Event signature (CRITICAL for Ethers.js and RPC stability)
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// ABI for the NFT contract's 'safeMint' function (needed for the Indexer to mint the NFT)
const NFT_ABI_SNIPPET = [
    "function safeMint(address to, string memory uri) public returns (uint256)",
    "function owner() public view returns (address)"
];

// ABI for the ERC-721 'tokenURI' function (for checking minted NFTs)
const TOKEN_URI_ABI_SNIPPET = [
    "function tokenURI(uint256 tokenId) view returns (string)"
];

// Export all constants for use in the other files
export {
    INK_CHAIN_ID,
    INK_RPC_URL, // Added to export list for potential provider use
    NFT_CONTRACT_ADDRESS,
    BERT_TOKEN_ADDRESS,
    BURN_ADDRESS,
    MINT_FEE_AMOUNT,
    BERT_ABI_SNIPPET,
    NFT_ABI_SNIPPET,
    TOKEN_URI_ABI_SNIPPET
};