// Polygon Mainnet addresses
export const POLYGON_ADDRESSES = {
  // Tokens
  WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',

  // QuickSwap (UniV2)
  QUICKSWAP: {
    FACTORY: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
    ROUTER: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
    INIT_CODE_HASH: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'
  },

  // SushiSwap (UniV2)
  SUSHISWAP: {
    FACTORY: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    ROUTER: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', 
    INIT_CODE_HASH: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303'
  }
};

export const TOKEN_DECIMALS = {
  [POLYGON_ADDRESSES.WMATIC]: 18,
  [POLYGON_ADDRESSES.WETH]: 18,
  [POLYGON_ADDRESSES.USDC]: 6,
  [POLYGON_ADDRESSES.USDT]: 6,
  [POLYGON_ADDRESSES.DAI]: 18
};

export const TOKEN_SYMBOLS = {
  [POLYGON_ADDRESSES.WMATIC]: 'WMATIC',
  [POLYGON_ADDRESSES.WETH]: 'WETH',
  [POLYGON_ADDRESSES.USDC]: 'USDC',
  [POLYGON_ADDRESSES.USDT]: 'USDT',
  [POLYGON_ADDRESSES.DAI]: 'DAI'
};

// Common trading pairs
export const TRADING_PAIRS = [
  [POLYGON_ADDRESSES.USDC, POLYGON_ADDRESSES.WETH],
  [POLYGON_ADDRESSES.USDC, POLYGON_ADDRESSES.WMATIC],
  [POLYGON_ADDRESSES.WETH, POLYGON_ADDRESSES.WMATIC],
  [POLYGON_ADDRESSES.USDT, POLYGON_ADDRESSES.WETH],
  [POLYGON_ADDRESSES.USDT, POLYGON_ADDRESSES.USDC],
  [POLYGON_ADDRESSES.DAI, POLYGON_ADDRESSES.USDC]
];

// UniV2 ABIs (minimal)
export const UNISWAP_V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'event Sync(uint112 reserve0, uint112 reserve1)'
];

export const UNISWAP_V2_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)'
];

export const UNISWAP_V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)'
];

export const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)'
];
