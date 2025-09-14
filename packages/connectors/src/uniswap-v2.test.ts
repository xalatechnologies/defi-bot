import { ethers } from 'ethers';
import { UniswapV2Connector } from './uniswap-v2';
import { PolygonConnectors } from './polygon';
import { POLYGON_ADDRESSES, TRADING_PAIRS } from './constants';

// Mock ethers provider for testing
const createMockProvider = (overrides: Partial<any> = {}) => {
  const defaultMocks = {
    getNetwork: jest.fn().mockResolvedValue({ chainId: 137, name: 'polygon' }),
    getFeeData: jest.fn().mockResolvedValue({
      gasPrice: ethers.parseUnits('25', 'gwei'),
      maxFeePerGas: ethers.parseUnits('30', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
    }),
    getBlockNumber: jest.fn().mockResolvedValue(50000000),
    call: jest.fn()
  };

  return {
    ...defaultMocks,
    ...overrides
  } as unknown as ethers.JsonRpcProvider;
};

// Mock contract for testing
const createMockContract = (overrides: Partial<any> = {}) => {
  return {
    getPair: jest.fn(),
    allPairs: jest.fn(), 
    allPairsLength: jest.fn(),
    getReserves: jest.fn(),
    token0: jest.fn(),
    token1: jest.fn(),
    getAmountsOut: jest.fn(),
    swapExactTokensForTokens: {
      estimateGas: jest.fn()
    },
    ...overrides
  } as any;
};

describe('UniswapV2Connector - Network Connection & Initialization', () => {
  describe('Connector Initialization', () => {
    it('should initialize QuickSwap connector with correct configuration', () => {
      const mockProvider = createMockProvider();
      const rpcUrl = 'https://polygon-rpc.com';
      
      const quickswap = new UniswapV2Connector(
        'quickswap',
        rpcUrl,
        {
          factory: POLYGON_ADDRESSES.QUICKSWAP.FACTORY,
          router: POLYGON_ADDRESSES.QUICKSWAP.ROUTER,
          initCodeHash: POLYGON_ADDRESSES.QUICKSWAP.INIT_CODE_HASH
        }
      );

      expect(quickswap.getDexName()).toBe('quickswap');
      expect(quickswap.getFactoryAddress()).toBe(POLYGON_ADDRESSES.QUICKSWAP.FACTORY);
      expect(quickswap.getRouterAddress()).toBe(POLYGON_ADDRESSES.QUICKSWAP.ROUTER);
    });

    it('should initialize SushiSwap connector with correct configuration', () => {
      const rpcUrl = 'https://polygon-rpc.com';
      
      const sushiswap = new UniswapV2Connector(
        'sushiswap',
        rpcUrl,
        {
          factory: POLYGON_ADDRESSES.SUSHISWAP.FACTORY,
          router: POLYGON_ADDRESSES.SUSHISWAP.ROUTER,
          initCodeHash: POLYGON_ADDRESSES.SUSHISWAP.INIT_CODE_HASH
        }
      );

      expect(sushiswap.getDexName()).toBe('sushiswap');
      expect(sushiswap.getFactoryAddress()).toBe(POLYGON_ADDRESSES.SUSHISWAP.FACTORY);
      expect(sushiswap.getRouterAddress()).toBe(POLYGON_ADDRESSES.SUSHISWAP.ROUTER);
    });

    it('should initialize PolygonConnectors with both DEXes', () => {
      const rpcUrl = 'https://polygon-rpc.com';
      const polygonConnectors = new PolygonConnectors(rpcUrl);

      expect(polygonConnectors.quickswap).toBeInstanceOf(UniswapV2Connector);
      expect(polygonConnectors.sushiswap).toBeInstanceOf(UniswapV2Connector);
      expect(polygonConnectors.quickswap.getDexName()).toBe('quickswap');
      expect(polygonConnectors.sushiswap.getDexName()).toBe('sushiswap');
    });

    it('should get connector by name', () => {
      const rpcUrl = 'https://polygon-rpc.com';
      const polygonConnectors = new PolygonConnectors(rpcUrl);

      expect(polygonConnectors.getConnector('quickswap')).toBe(polygonConnectors.quickswap);
      expect(polygonConnectors.getConnector('sushiswap')).toBe(polygonConnectors.sushiswap);
      expect(polygonConnectors.getConnector('invalid')).toBeNull();
    });

    it('should return all connectors', () => {
      const rpcUrl = 'https://polygon-rpc.com';
      const polygonConnectors = new PolygonConnectors(rpcUrl);
      const allConnectors = polygonConnectors.getAllConnectors();

      expect(allConnectors).toHaveLength(2);
      expect(allConnectors[0]).toBe(polygonConnectors.quickswap);
      expect(allConnectors[1]).toBe(polygonConnectors.sushiswap);
    });
  });

  describe('Address Configuration Validation', () => {
    it('should have correct QuickSwap addresses', () => {
      expect(POLYGON_ADDRESSES.QUICKSWAP.FACTORY).toBe('0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32');
      expect(POLYGON_ADDRESSES.QUICKSWAP.ROUTER).toBe('0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff');
      expect(POLYGON_ADDRESSES.QUICKSWAP.INIT_CODE_HASH).toBe('0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f');
    });

    it('should have correct SushiSwap addresses', () => {
      expect(POLYGON_ADDRESSES.SUSHISWAP.FACTORY).toBe('0xc35DADB65012eC5796536bD9864eD8773aBc74C4');
      expect(POLYGON_ADDRESSES.SUSHISWAP.ROUTER).toBe('0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506');
      expect(POLYGON_ADDRESSES.SUSHISWAP.INIT_CODE_HASH).toBe('0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303');
    });

    it('should have correct token addresses', () => {
      expect(POLYGON_ADDRESSES.WMATIC).toBe('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270');
      expect(POLYGON_ADDRESSES.WETH).toBe('0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619');
      expect(POLYGON_ADDRESSES.USDC).toBe('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174');
      expect(POLYGON_ADDRESSES.USDT).toBe('0xc2132D05D31c914a87C6611C10748AEb04B58e8F');
      expect(POLYGON_ADDRESSES.DAI).toBe('0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063');
    });

    it('should have valid trading pairs', () => {
      expect(TRADING_PAIRS).toHaveLength(6);
      expect(TRADING_PAIRS[0]).toEqual([POLYGON_ADDRESSES.USDC, POLYGON_ADDRESSES.WETH]);
      expect(TRADING_PAIRS[1]).toEqual([POLYGON_ADDRESSES.USDC, POLYGON_ADDRESSES.WMATIC]);
    });
  });
});

describe('UniswapV2Connector - Pair Discovery', () => {
  let connector: UniswapV2Connector;
  let mockFactoryContract: any;

  beforeEach(() => {
    const rpcUrl = 'https://polygon-rpc.com';
    connector = new UniswapV2Connector(
      'quickswap',
      rpcUrl,
      {
        factory: POLYGON_ADDRESSES.QUICKSWAP.FACTORY,
        router: POLYGON_ADDRESSES.QUICKSWAP.ROUTER,
        initCodeHash: POLYGON_ADDRESSES.QUICKSWAP.INIT_CODE_HASH
      }
    );

    mockFactoryContract = createMockContract();
    (connector as any).factoryContract = mockFactoryContract;
  });

  describe('getPairAddress', () => {
    it('should get pair address from factory', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = POLYGON_ADDRESSES.WETH;
      const expectedPairAddress = '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d';

      mockFactoryContract.getPair.mockResolvedValue(expectedPairAddress);

      const pairAddress = await connector.getPairAddress(tokenA, tokenB);

      expect(pairAddress).toBe(expectedPairAddress);
      expect(mockFactoryContract.getPair).toHaveBeenCalledWith(tokenA, tokenB);
    });

    it('should return null for non-existent pair', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = '0x0000000000000000000000000000000000000000';

      mockFactoryContract.getPair.mockResolvedValue(ethers.ZeroAddress);

      const pairAddress = await connector.getPairAddress(tokenA, tokenB);

      expect(pairAddress).toBeNull();
    });

    it('should cache pair addresses', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = POLYGON_ADDRESSES.WETH;
      const expectedPairAddress = '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d';

      mockFactoryContract.getPair.mockResolvedValue(expectedPairAddress);

      // First call
      await connector.getPairAddress(tokenA, tokenB);
      // Second call should use cache
      const pairAddress = await connector.getPairAddress(tokenA, tokenB);

      expect(pairAddress).toBe(expectedPairAddress);
      expect(mockFactoryContract.getPair).toHaveBeenCalledTimes(1);
    });

    it('should handle factory contract errors', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = POLYGON_ADDRESSES.WETH;

      mockFactoryContract.getPair.mockRejectedValue(new Error('RPC Error'));

      const pairAddress = await connector.getPairAddress(tokenA, tokenB);

      expect(pairAddress).toBeNull();
    });
  });

  describe('getAllPairs', () => {
    it('should fetch all pairs with batching', async () => {
      const totalPairs = 250; // More than batch size to test batching
      const mockPairAddresses = Array.from({ length: totalPairs }, (_, i) => 
        `0x${i.toString(16).padStart(40, '0')}`
      );

      mockFactoryContract.allPairsLength.mockResolvedValue(BigInt(totalPairs));
      
      // Mock allPairs calls for batching
      for (let i = 0; i < totalPairs; i++) {
        mockFactoryContract.allPairs.mockResolvedValueOnce(mockPairAddresses[i]);
      }

      // Mock pair contract calls
      const mockPairContract = createMockContract({
        token0: jest.fn().mockResolvedValue(POLYGON_ADDRESSES.USDC),
        token1: jest.fn().mockResolvedValue(POLYGON_ADDRESSES.WETH)
      });

      // Mock contract instantiation
      jest.spyOn(ethers, 'Contract').mockReturnValue(mockPairContract as any);

      const pairs = await connector.getAllPairs();

      expect(pairs).toHaveLength(totalPairs);
      expect(mockFactoryContract.allPairsLength).toHaveBeenCalledTimes(1);
      expect(mockFactoryContract.allPairs).toHaveBeenCalledTimes(totalPairs);
    });

    it('should handle empty pair list', async () => {
      mockFactoryContract.allPairsLength.mockResolvedValue(BigInt(0));

      const pairs = await connector.getAllPairs();

      expect(pairs).toHaveLength(0);
    });

    it('should handle factory contract errors gracefully', async () => {
      mockFactoryContract.allPairsLength.mockRejectedValue(new Error('Network error'));

      const pairs = await connector.getAllPairs();

      expect(pairs).toHaveLength(0);
    });

    it('should include correct pair data structure', async () => {
      const mockPairAddress = '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d';
      
      mockFactoryContract.allPairsLength.mockResolvedValue(BigInt(1));
      mockFactoryContract.allPairs.mockResolvedValue(mockPairAddress);

      const mockPairContract = createMockContract({
        token0: jest.fn().mockResolvedValue(POLYGON_ADDRESSES.USDC),
        token1: jest.fn().mockResolvedValue(POLYGON_ADDRESSES.WETH)
      });

      jest.spyOn(ethers, 'Contract').mockReturnValue(mockPairContract as any);

      const pairs = await connector.getAllPairs();

      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual({
        address: mockPairAddress,
        token0: POLYGON_ADDRESSES.USDC,
        token1: POLYGON_ADDRESSES.WETH,
        symbol0: 'USDC',
        symbol1: 'WETH',
        dex: 'quickswap'
      });
    });

    it('should skip pairs with contract errors', async () => {
      const totalPairs = 3;
      const mockPairAddresses = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333'
      ];

      mockFactoryContract.allPairsLength.mockResolvedValue(BigInt(totalPairs));
      mockFactoryContract.allPairs
        .mockResolvedValueOnce(mockPairAddresses[0])
        .mockResolvedValueOnce(mockPairAddresses[1])
        .mockResolvedValueOnce(mockPairAddresses[2]);

      // Mock pair contracts - middle one throws error
      const workingPairContract = createMockContract({
        token0: jest.fn().mockResolvedValue(POLYGON_ADDRESSES.USDC),
        token1: jest.fn().mockResolvedValue(POLYGON_ADDRESSES.WETH)
      });

      const errorPairContract = createMockContract({
        token0: jest.fn().mockRejectedValue(new Error('Contract error')),
        token1: jest.fn().mockRejectedValue(new Error('Contract error'))
      });

      jest.spyOn(ethers, 'Contract')
        .mockReturnValueOnce(workingPairContract as any)
        .mockReturnValueOnce(errorPairContract as any)
        .mockReturnValueOnce(workingPairContract as any);

      const pairs = await connector.getAllPairs();

      expect(pairs).toHaveLength(2); // Should skip the erroring pair
    });
  });
});

describe('UniswapV2Connector - Reserve Reading', () => {
  let connector: UniswapV2Connector;
  let mockFactoryContract: any;

  beforeEach(() => {
    const rpcUrl = 'https://polygon-rpc.com';
    connector = new UniswapV2Connector(
      'quickswap',
      rpcUrl,
      {
        factory: POLYGON_ADDRESSES.QUICKSWAP.FACTORY,
        router: POLYGON_ADDRESSES.QUICKSWAP.ROUTER,
        initCodeHash: POLYGON_ADDRESSES.QUICKSWAP.INIT_CODE_HASH
      }
    );

    mockFactoryContract = createMockContract();
    (connector as any).factoryContract = mockFactoryContract;
  });

  describe('getReserves', () => {
    it('should get reserves for existing pair with correct token ordering', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = POLYGON_ADDRESSES.WETH;
      const pairAddress = '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d';

      mockFactoryContract.getPair.mockResolvedValue(pairAddress);

      const mockPairContract = createMockContract({
        getReserves: jest.fn().mockResolvedValue([
          ethers.parseUnits('1000000', 6), // reserve0 (USDC)
          ethers.parseUnits('500', 18),    // reserve1 (WETH)
          1640000000                        // blockTimestampLast
        ]),
        token0: jest.fn().mockResolvedValue(tokenA) // USDC is token0
      });

      jest.spyOn(ethers, 'Contract').mockReturnValue(mockPairContract as any);

      const reserves = await connector.getReserves(tokenA, tokenB);

      expect(reserves).toEqual({
        reserve0: ethers.parseUnits('1000000', 6),
        reserve1: ethers.parseUnits('500', 18),
        blockTimestampLast: 1640000000
      });
    });

    it('should handle reversed token ordering', async () => {
      const tokenA = POLYGON_ADDRESSES.WETH;
      const tokenB = POLYGON_ADDRESSES.USDC;
      const pairAddress = '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d';

      mockFactoryContract.getPair.mockResolvedValue(pairAddress);

      const mockPairContract = createMockContract({
        getReserves: jest.fn().mockResolvedValue([
          ethers.parseUnits('1000000', 6), // reserve0 (USDC)
          ethers.parseUnits('500', 18),    // reserve1 (WETH)
          1640000000
        ]),
        token0: jest.fn().mockResolvedValue(POLYGON_ADDRESSES.USDC) // USDC is token0, not WETH
      });

      jest.spyOn(ethers, 'Contract').mockReturnValue(mockPairContract as any);

      const reserves = await connector.getReserves(tokenA, tokenB);

      // Should swap reserves since tokenA (WETH) is not token0
      expect(reserves).toEqual({
        reserve0: ethers.parseUnits('500', 18),    // WETH reserve
        reserve1: ethers.parseUnits('1000000', 6), // USDC reserve
        blockTimestampLast: 1640000000
      });
    });

    it('should return null for non-existent pair', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = '0x0000000000000000000000000000000000000000';

      mockFactoryContract.getPair.mockResolvedValue(ethers.ZeroAddress);

      const reserves = await connector.getReserves(tokenA, tokenB);

      expect(reserves).toBeNull();
    });

    it('should handle contract errors gracefully', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = POLYGON_ADDRESSES.WETH;
      const pairAddress = '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d';

      mockFactoryContract.getPair.mockResolvedValue(pairAddress);

      const mockPairContract = createMockContract({
        getReserves: jest.fn().mockRejectedValue(new Error('Contract error')),
        token0: jest.fn().mockRejectedValue(new Error('Contract error'))
      });

      jest.spyOn(ethers, 'Contract').mockReturnValue(mockPairContract as any);

      const reserves = await connector.getReserves(tokenA, tokenB);

      expect(reserves).toBeNull();
    });

    it('should test all major trading pairs', async () => {
      const testPairs = [
        [POLYGON_ADDRESSES.USDC, POLYGON_ADDRESSES.WETH],
        [POLYGON_ADDRESSES.USDC, POLYGON_ADDRESSES.WMATIC],
        [POLYGON_ADDRESSES.WETH, POLYGON_ADDRESSES.WMATIC],
        [POLYGON_ADDRESSES.USDT, POLYGON_ADDRESSES.USDC],
        [POLYGON_ADDRESSES.DAI, POLYGON_ADDRESSES.USDC]
      ];

      mockFactoryContract.getPair.mockResolvedValue('0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d');

      const mockPairContract = createMockContract({
        getReserves: jest.fn().mockResolvedValue([
          ethers.parseUnits('1000000', 18),
          ethers.parseUnits('500000', 18),
          1640000000
        ]),
        token0: jest.fn().mockResolvedValue(testPairs[0][0])
      });

      jest.spyOn(ethers, 'Contract').mockReturnValue(mockPairContract as any);

      for (const [tokenA, tokenB] of testPairs) {
        const reserves = await connector.getReserves(tokenA, tokenB);
        expect(reserves).not.toBeNull();
        expect(reserves?.reserve0).toBeGreaterThan(0n);
        expect(reserves?.reserve1).toBeGreaterThan(0n);
        expect(reserves?.blockTimestampLast).toBeGreaterThan(0);
      }
    });
  });
});

describe('UniswapV2Connector - Swap Simulation', () => {
  let connector: UniswapV2Connector;
  let mockFactoryContract: any;
  let mockRouterContract: any;

  beforeEach(() => {
    const rpcUrl = 'https://polygon-rpc.com';
    connector = new UniswapV2Connector(
      'quickswap',
      rpcUrl,
      {
        factory: POLYGON_ADDRESSES.QUICKSWAP.FACTORY,
        router: POLYGON_ADDRESSES.QUICKSWAP.ROUTER,
        initCodeHash: POLYGON_ADDRESSES.QUICKSWAP.INIT_CODE_HASH
      }
    );

    mockFactoryContract = createMockContract();
    mockRouterContract = createMockContract();
    (connector as any).factoryContract = mockFactoryContract;
    (connector as any).routerContract = mockRouterContract;
  });

  describe('simulateSwap', () => {
    it('should simulate swap using UniV2 formula', async () => {
      const tokenIn = POLYGON_ADDRESSES.USDC;
      const tokenOut = POLYGON_ADDRESSES.WETH;
      const amountIn = ethers.parseUnits('1000', 6); // 1000 USDC
      const pairAddress = '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d';

      // Mock reserves: 1M USDC, 500 WETH
      const reserveIn = ethers.parseUnits('1000000', 6);
      const reserveOut = ethers.parseUnits('500', 18);

      mockFactoryContract.getPair.mockResolvedValue(pairAddress);

      const mockPairContract = createMockContract({
        getReserves: jest.fn().mockResolvedValue([
          reserveIn,  // reserve0 (USDC)
          reserveOut, // reserve1 (WETH)
          1640000000
        ]),
        token0: jest.fn().mockResolvedValue(tokenIn)
      });

      jest.spyOn(ethers, 'Contract').mockReturnValue(mockPairContract as any);

      const amountOut = await connector.simulateSwap(tokenIn, tokenOut, amountIn);

      expect(amountOut).not.toBeNull();
      expect(amountOut).toBeGreaterThan(0n);
      
      // Basic sanity check: should get less than 1 WETH for 1000 USDC
      expect(amountOut).toBeLessThan(ethers.parseUnits('1', 18));
    });

    it('should simulate swap in reverse direction', async () => {
      const tokenIn = POLYGON_ADDRESSES.WETH;
      const tokenOut = POLYGON_ADDRESSES.USDC;
      const amountIn = ethers.parseUnits('1', 18); // 1 WETH
      const pairAddress = '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d';

      // Mock reserves: 1M USDC, 500 WETH
      const reserveUSDC = ethers.parseUnits('1000000', 6);
      const reserveWETH = ethers.parseUnits('500', 18);

      mockFactoryContract.getPair.mockResolvedValue(pairAddress);

      const mockPairContract = createMockContract({
        getReserves: jest.fn().mockResolvedValue([
          reserveUSDC, // reserve0 (USDC)
          reserveWETH, // reserve1 (WETH)
          1640000000
        ]),
        token0: jest.fn().mockResolvedValue(POLYGON_ADDRESSES.USDC) // USDC is token0
      });

      jest.spyOn(ethers, 'Contract').mockReturnValue(mockPairContract as any);

      const amountOut = await connector.simulateSwap(tokenIn, tokenOut, amountIn);

      expect(amountOut).not.toBeNull();
      expect(amountOut).toBeGreaterThan(0n);
      
      // Should get roughly ~2000 USDC for 1 WETH (given the reserves)
      expect(amountOut).toBeGreaterThan(ethers.parseUnits('1500', 6));
    });

    it('should return null for non-existent pair', async () => {
      const tokenIn = POLYGON_ADDRESSES.USDC;
      const tokenOut = '0x0000000000000000000000000000000000000000';
      const amountIn = ethers.parseUnits('1000', 6);

      mockFactoryContract.getPair.mockResolvedValue(ethers.ZeroAddress);

      const amountOut = await connector.simulateSwap(tokenIn, tokenOut, amountIn);

      expect(amountOut).toBeNull();
    });

    it('should handle various trade sizes', async () => {
      const tokenIn = POLYGON_ADDRESSES.USDC;
      const tokenOut = POLYGON_ADDRESSES.WETH;
      const pairAddress = '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d';

      const reserveIn = ethers.parseUnits('1000000', 6);
      const reserveOut = ethers.parseUnits('500', 18);

      mockFactoryContract.getPair.mockResolvedValue(pairAddress);

      const mockPairContract = createMockContract({
        getReserves: jest.fn().mockResolvedValue([
          reserveIn, reserveOut, 1640000000
        ]),
        token0: jest.fn().mockResolvedValue(tokenIn)
      });

      jest.spyOn(ethers, 'Contract').mockReturnValue(mockPairContract as any);

      const tradeSizes = [
        ethers.parseUnits('100', 6),    // $100
        ethers.parseUnits('1000', 6),   // $1,000
        ethers.parseUnits('10000', 6),  // $10,000
        ethers.parseUnits('50000', 6)   // $50,000
      ];

      let previousAmountOut = 0n;

      for (const amountIn of tradeSizes) {
        const amountOut = await connector.simulateSwap(tokenIn, tokenOut, amountIn);
        expect(amountOut).not.toBeNull();
        expect(amountOut).toBeGreaterThan(previousAmountOut);
        previousAmountOut = amountOut!;
      }
    });

    it('should handle simulation errors gracefully', async () => {
      const tokenIn = POLYGON_ADDRESSES.USDC;
      const tokenOut = POLYGON_ADDRESSES.WETH;
      const amountIn = ethers.parseUnits('1000', 6);
      const pairAddress = '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d';

      mockFactoryContract.getPair.mockResolvedValue(pairAddress);

      const mockPairContract = createMockContract({
        getReserves: jest.fn().mockRejectedValue(new Error('Simulation error')),
        token0: jest.fn().mockRejectedValue(new Error('Simulation error'))
      });

      jest.spyOn(ethers, 'Contract').mockReturnValue(mockPairContract as any);

      const amountOut = await connector.simulateSwap(tokenIn, tokenOut, amountIn);

      expect(amountOut).toBeNull();
    });
  });

  describe('getAmountsOut', () => {
    it('should get amounts out for multi-hop path', async () => {
      const amountIn = ethers.parseUnits('1000', 6);
      const path = [POLYGON_ADDRESSES.USDC, POLYGON_ADDRESSES.WETH, POLYGON_ADDRESSES.WMATIC];
      
      const expectedAmounts = [
        amountIn,
        ethers.parseUnits('0.5', 18),   // 0.5 WETH
        ethers.parseUnits('800', 18)    // 800 WMATIC
      ];

      mockRouterContract.getAmountsOut.mockResolvedValue(expectedAmounts);

      const amounts = await connector.getAmountsOut(amountIn, path);

      expect(amounts).toEqual(expectedAmounts);
      expect(mockRouterContract.getAmountsOut).toHaveBeenCalledWith(amountIn, path);
    });

    it('should return null on router error', async () => {
      const amountIn = ethers.parseUnits('1000', 6);
      const path = [POLYGON_ADDRESSES.USDC, POLYGON_ADDRESSES.WETH];

      mockRouterContract.getAmountsOut.mockRejectedValue(new Error('Router error'));

      const amounts = await connector.getAmountsOut(amountIn, path);

      expect(amounts).toBeNull();
    });
  });

  describe('estimateSwapGas', () => {
    it('should estimate gas for swap transaction', async () => {
      const tokenIn = POLYGON_ADDRESSES.USDC;
      const tokenOut = POLYGON_ADDRESSES.WETH;
      const amountIn = ethers.parseUnits('1000', 6);
      const amountOutMin = ethers.parseUnits('0.4', 18);
      const deadline = Math.floor(Date.now() / 1000) + 1800;
      const fromAddress = '0x1234567890123456789012345678901234567890';

      const expectedGas = BigInt(150000);
      mockRouterContract.swapExactTokensForTokens.estimateGas.mockResolvedValue(expectedGas);

      const gasEstimate = await connector.estimateSwapGas(
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        deadline,
        fromAddress
      );

      expect(gasEstimate).toBe(expectedGas);
    });

    it('should return fallback gas on estimation error', async () => {
      const tokenIn = POLYGON_ADDRESSES.USDC;
      const tokenOut = POLYGON_ADDRESSES.WETH;
      const amountIn = ethers.parseUnits('1000', 6);
      const amountOutMin = ethers.parseUnits('0.4', 18);
      const deadline = Math.floor(Date.now() / 1000) + 1800;
      const fromAddress = '0x1234567890123456789012345678901234567890';

      mockRouterContract.swapExactTokensForTokens.estimateGas.mockRejectedValue(new Error('Gas estimation failed'));

      const gasEstimate = await connector.estimateSwapGas(
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        deadline,
        fromAddress
      );

      expect(gasEstimate).toBe(BigInt(150000)); // Fallback value
    });
  });
});

describe('PolygonConnectors - Integration Tests', () => {
  let polygonConnectors: PolygonConnectors;

  beforeEach(() => {
    const rpcUrl = 'https://polygon-rpc.com';
    polygonConnectors = new PolygonConnectors(rpcUrl);
  });

  describe('pairExistsOnBoth', () => {
    it('should check if pair exists on both DEXes', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = POLYGON_ADDRESSES.WETH;

      // Mock both connectors to return pair addresses
      jest.spyOn(polygonConnectors.quickswap, 'getPairAddress').mockResolvedValue('0x1111111111111111111111111111111111111111');
      jest.spyOn(polygonConnectors.sushiswap, 'getPairAddress').mockResolvedValue('0x2222222222222222222222222222222222222222');

      const exists = await polygonConnectors.pairExistsOnBoth(tokenA, tokenB);

      expect(exists).toBe(true);
    });

    it('should return false if pair missing on one DEX', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = POLYGON_ADDRESSES.WETH;

      jest.spyOn(polygonConnectors.quickswap, 'getPairAddress').mockResolvedValue('0x1111111111111111111111111111111111111111');
      jest.spyOn(polygonConnectors.sushiswap, 'getPairAddress').mockResolvedValue(null);

      const exists = await polygonConnectors.pairExistsOnBoth(tokenA, tokenB);

      expect(exists).toBe(false);
    });
  });

  describe('findArbitrageOpportunities', () => {
    it('should find arbitrage opportunities between DEXes', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = POLYGON_ADDRESSES.WETH;

      // Mock different reserves on each DEX
      jest.spyOn(polygonConnectors.quickswap, 'getReserves').mockResolvedValue({
        reserve0: ethers.parseUnits('1000000', 6), // 1M USDC
        reserve1: ethers.parseUnits('500', 18),    // 500 WETH
        blockTimestampLast: 1640000000
      });

      jest.spyOn(polygonConnectors.sushiswap, 'getReserves').mockResolvedValue({
        reserve0: ethers.parseUnits('1100000', 6), // 1.1M USDC  
        reserve1: ethers.parseUnits('500', 18),    // 500 WETH
        blockTimestampLast: 1640000000
      });

      const opportunity = await polygonConnectors.findArbitrageOpportunities(tokenA, tokenB);

      expect(opportunity).not.toBeNull();
      expect(opportunity?.quickswapPrice).toBeDefined();
      expect(opportunity?.sushiswapPrice).toBeDefined();
      expect(opportunity?.spreadBps).toBeGreaterThan(0);
      expect(['quickswap', 'sushiswap']).toContain(opportunity?.bestBuy);
      expect(['quickswap', 'sushiswap']).toContain(opportunity?.bestSell);
    });

    it('should return null if reserves missing', async () => {
      const tokenA = POLYGON_ADDRESSES.USDC;
      const tokenB = POLYGON_ADDRESSES.WETH;

      jest.spyOn(polygonConnectors.quickswap, 'getReserves').mockResolvedValue(null);
      jest.spyOn(polygonConnectors.sushiswap, 'getReserves').mockResolvedValue({
        reserve0: ethers.parseUnits('1000000', 6),
        reserve1: ethers.parseUnits('500', 18),
        blockTimestampLast: 1640000000
      });

      const opportunity = await polygonConnectors.findArbitrageOpportunities(tokenA, tokenB);

      expect(opportunity).toBeNull();
    });
  });

  describe('discoverAllPairs', () => {
    it('should discover pairs from all DEXes', async () => {
      const quickswapPairs = [
        {
          address: '0x1111111111111111111111111111111111111111',
          token0: POLYGON_ADDRESSES.USDC,
          token1: POLYGON_ADDRESSES.WETH,
          symbol0: 'USDC',
          symbol1: 'WETH',
          dex: 'quickswap'
        }
      ];

      const sushiswapPairs = [
        {
          address: '0x2222222222222222222222222222222222222222',
          token0: POLYGON_ADDRESSES.USDC,
          token1: POLYGON_ADDRESSES.WMATIC,
          symbol0: 'USDC',
          symbol1: 'WMATIC',
          dex: 'sushiswap'
        }
      ];

      jest.spyOn(polygonConnectors.quickswap, 'getAllPairs').mockResolvedValue(quickswapPairs);
      jest.spyOn(polygonConnectors.sushiswap, 'getAllPairs').mockResolvedValue(sushiswapPairs);

      const allPairs = await polygonConnectors.discoverAllPairs();

      expect(allPairs).toHaveLength(2);
      expect(allPairs).toEqual([...quickswapPairs, ...sushiswapPairs]);
    });

    it('should handle errors from individual connectors', async () => {
      const quickswapPairs = [
        {
          address: '0x1111111111111111111111111111111111111111',
          token0: POLYGON_ADDRESSES.USDC,
          token1: POLYGON_ADDRESSES.WETH,
          symbol0: 'USDC',
          symbol1: 'WETH',
          dex: 'quickswap'
        }
      ];

      jest.spyOn(polygonConnectors.quickswap, 'getAllPairs').mockResolvedValue(quickswapPairs);
      jest.spyOn(polygonConnectors.sushiswap, 'getAllPairs').mockRejectedValue(new Error('Sushiswap error'));

      const allPairs = await polygonConnectors.discoverAllPairs();

      expect(allPairs).toHaveLength(1);
      expect(allPairs).toEqual(quickswapPairs);
    });
  });

  describe('getTokenAddresses', () => {
    it('should return correct token addresses', () => {
      const addresses = polygonConnectors.getTokenAddresses();

      expect(addresses).toEqual({
        WMATIC: POLYGON_ADDRESSES.WMATIC,
        WETH: POLYGON_ADDRESSES.WETH,
        USDC: POLYGON_ADDRESSES.USDC,
        USDT: POLYGON_ADDRESSES.USDT,
        DAI: POLYGON_ADDRESSES.DAI
      });
    });
  });
});