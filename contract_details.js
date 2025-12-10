// --- INK L2 NETWORK CONFIGURATION ---
const INK_CHAIN_ID = 57073;
const INK_RPC_URL = 'https://rpc-gel.inkonchain.com'; // Public RPC for the Ink L2 Mainnet

// --- DEPLOYED CONTRACT ADDRESSES ---
// The NFT contract you deployed and verified. 
const NFT_CONTRACT_ADDRESS = '0x86d5cd3150Bbf93b179166dCd0A060e3B6b0CE01';

// The BERT token contract address (used as the fee token).
const BERT_TOKEN_ADDRESS = '0x62c99FAc20B33b5423fdf9226179e973A8353e36';

// The address where the BERT fee will be sent (burned).
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

// --- APPLICATION CONFIGURATION ---
// The amount of BERT required for a single inscription mint.
const MINT_FEE_AMOUNT = 1000;

// --- ABI SNIPPETS ---
// ABI for the BERT token (ERC-20 functions)
const BERT_ABI_SNIPPET = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// UPDATED: Matches your new Solidity Contract (Inkscriptions_nft.sol)
// Function: wrapEdition(bytes32 originalTxHash, bytes32 contentHash, uint256 supplyAmount, uint256 inkscriptionIndex, string tokenURI, bytes signature)
const NFT_ABI_SNIPPET = [
    // The main function to mint a verified Inkscription
    "function wrapEdition(bytes32 originalTxHash, bytes32 contentHash, uint256 supplyAmount, uint256 inkscriptionIndex, string memory tokenURI, bytes memory signature) external",
    
    "function owner() public view returns (address)"
];

// ABI for the ERC-721 'tokenURI' function (for checking minted NFTs)
const TOKEN_URI_ABI_SNIPPET = [
    "function tokenURI(uint256 tokenId) view returns (string)"
];

export {
    INK_CHAIN_ID,
    INK_RPC_URL,
    NFT_CONTRACT_ADDRESS,
    BERT_TOKEN_ADDRESS,
    BURN_ADDRESS,
    MINT_FEE_AMOUNT,
    BERT_ABI_SNIPPET,
    NFT_ABI_SNIPPET,
    TOKEN_URI_ABI_SNIPPET
};