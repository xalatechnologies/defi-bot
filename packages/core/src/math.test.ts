import { ethers } from 'ethers';
import {
  calculateMidPrice,
  priceFromReserves,
  calculateSpreadBps,
  calculateSlippage,
  getAmountOut,
  getAmountIn,
  findOptimalAmount,
  calculatePriceImpact
} from './math';

describe('Math Module - Price Calculations', () => {
  describe('calculateMidPrice', () => {
    it('should calculate correct mid-price for normal reserves', () => {
      const reserve0 = BigInt('1000000000000000000000'); // 1000 tokens
      const reserve1 = BigInt('2000000000000000000000'); // 2000 tokens
      const price = calculateMidPrice(reserve0, reserve1);
      expect(price).toBe(2); // 2000/1000 = 2
    });

    it('should handle zero reserves gracefully', () => {
      expect(calculateMidPrice(0n, BigInt('1000'))).toBe(0);
      expect(calculateMidPrice(BigInt('1000'), 0n)).toBe(0);
      expect(calculateMidPrice(0n, 0n)).toBe(0);
    });

    it('should handle very large numbers', () => {
      const reserve0 = BigInt('1000000000000000000000000000'); // 1B tokens
      const reserve1 = BigInt('500000000000000000000000000');  // 500M tokens
      const price = calculateMidPrice(reserve0, reserve1);
      expect(price).toBe(0.5);
    });

    it('should handle very small ratios', () => {
      const reserve0 = BigInt('1000000000000000000000'); // 1000 tokens
      const reserve1 = BigInt('1000000000000000000');    // 1 token
      const price = calculateMidPrice(reserve0, reserve1);
      expect(price).toBe(0.001);
    });
  });

  describe('priceFromReserves', () => {
    it('should calculate price with standard 18 decimals', () => {
      const reserve0 = ethers.parseUnits('1000', 18);
      const reserve1 = ethers.parseUnits('2000', 18);
      const price = priceFromReserves(reserve0, reserve1, 18, 18);
      expect(price).toBe(2);
    });

    it('should handle different decimal configurations', () => {
      // USDC (6 decimals) vs ETH (18 decimals)
      const reserve0 = BigInt('1000000000'); // 1000 USDC (6 decimals)
      const reserve1 = ethers.parseUnits('0.5', 18); // 0.5 ETH
      const price = priceFromReserves(reserve0, reserve1, 6, 18);
      expect(price).toBeCloseTo(0.0005, 6); // 0.5/1000 = 0.0005
    });

    it('should handle WBTC (8 decimals) pricing', () => {
      const reserve0 = BigInt('100000000'); // 1 WBTC (8 decimals)
      const reserve1 = ethers.parseUnits('30000', 6); // 30,000 USDC (6 decimals)
      const price = priceFromReserves(reserve0, reserve1, 8, 6);
      expect(price).toBe(30000); // 30000/1 = 30000
    });

    it('should return 0 for zero reserves', () => {
      expect(priceFromReserves(0n, ethers.parseUnits('100', 18))).toBe(0);
      expect(priceFromReserves(ethers.parseUnits('100', 18), 0n)).toBe(0);
    });
  });

  describe('calculateSpreadBps', () => {
    it('should calculate simple arbitrage spread correctly', () => {
      const priceA = 2000; // ETH price on DEX A
      const priceB = 2020; // ETH price on DEX B
      const spreadBps = calculateSpreadBps(priceA, priceB);
      expect(spreadBps).toBeCloseTo(99.5, 1); // ~1% spread
    });

    it('should calculate triangular arbitrage spread', () => {
      // Example: ETH/USDC -> USDC/DAI -> DAI/ETH
      const priceA = 0.0005; // ETH/USDC rate
      const priceB = 1.001;  // USDC/DAI rate  
      const priceC = 1998;   // DAI/ETH rate
      const spreadBps = calculateSpreadBps(priceA, priceB, priceC);
      expect(spreadBps).toBeGreaterThan(0);
    });

    it('should handle identical prices', () => {
      const spreadBps = calculateSpreadBps(2000, 2000);
      expect(spreadBps).toBe(0);
    });

    it('should handle very small spreads', () => {
      const priceA = 2000.00;
      const priceB = 2000.01;
      const spreadBps = calculateSpreadBps(priceA, priceB);
      expect(spreadBps).toBeCloseTo(0.05, 2); // 0.005% spread
    });

    it('should handle large spreads', () => {
      const priceA = 1800;
      const priceB = 2200;
      const spreadBps = calculateSpreadBps(priceA, priceB);
      expect(spreadBps).toBeCloseTo(2000, 0); // 20% spread
    });
  });

  describe('calculateSlippage', () => {
    it('should calculate slippage cost correctly', () => {
      const amountUsd = 10000;
      const slippageBps = 50; // 0.5%
      const slippageCost = calculateSlippage(amountUsd, slippageBps);
      expect(slippageCost).toBe(50); // $50 slippage cost
    });

    it('should handle zero amounts', () => {
      expect(calculateSlippage(0, 50)).toBe(0);
    });

    it('should handle zero slippage', () => {
      expect(calculateSlippage(10000, 0)).toBe(0);
    });

    it('should handle high slippage scenarios', () => {
      const amountUsd = 100000;
      const slippageBps = 300; // 3%
      const slippageCost = calculateSlippage(amountUsd, slippageBps);
      expect(slippageCost).toBe(3000); // $3000 slippage cost
    });
  });
});

describe('Math Module - UniswapV2 Formulas', () => {
  describe('getAmountOut', () => {
    it('should calculate correct output for standard trade', () => {
      const amountIn = ethers.parseUnits('1', 18); // 1 ETH
      const reserveIn = ethers.parseUnits('100', 18); // 100 ETH reserve
      const reserveOut = ethers.parseUnits('200000', 6); // 200k USDC reserve
      
      const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
      
      // Expected: roughly 1980 USDC (with 0.3% fee)
      expect(Number(amountOut)).toBeGreaterThan(1900000000); // > 1900 USDC
      expect(Number(amountOut)).toBeLessThan(2000000000);    // < 2000 USDC
    });

    it('should handle zero inputs correctly', () => {
      const reserveIn = ethers.parseUnits('100', 18);
      const reserveOut = ethers.parseUnits('200000', 6);
      
      expect(getAmountOut(0n, reserveIn, reserveOut)).toBe(0n);
      expect(getAmountOut(ethers.parseUnits('1', 18), 0n, reserveOut)).toBe(0n);
      expect(getAmountOut(ethers.parseUnits('1', 18), reserveIn, 0n)).toBe(0n);
    });

    it('should handle different fee rates', () => {
      const amountIn = ethers.parseUnits('1', 18);
      const reserveIn = ethers.parseUnits('100', 18);
      const reserveOut = ethers.parseUnits('200000', 6);
      
      const standardFee = getAmountOut(amountIn, reserveIn, reserveOut, 30); // 0.3%
      const lowFee = getAmountOut(amountIn, reserveIn, reserveOut, 5); // 0.05%
      const highFee = getAmountOut(amountIn, reserveIn, reserveOut, 100); // 1%
      
      expect(lowFee).toBeGreaterThan(standardFee);
      expect(standardFee).toBeGreaterThan(highFee);
    });

    it('should handle very large trades', () => {
      const amountIn = ethers.parseUnits('10', 18); // 10 ETH
      const reserveIn = ethers.parseUnits('100', 18); // 100 ETH reserve
      const reserveOut = ethers.parseUnits('200000', 6); // 200k USDC reserve
      
      const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
      
      // Large trade should have significant price impact
      expect(Number(amountOut)).toBeLessThan(18000000000); // < 18k USDC (significant slippage)
    });
  });

  describe('getAmountIn', () => {
    it('should calculate correct input for desired output', () => {
      const amountOut = BigInt('1000000000'); // 1000 USDC
      const reserveIn = ethers.parseUnits('100', 18); // 100 ETH reserve
      const reserveOut = ethers.parseUnits('200000', 6); // 200k USDC reserve
      
      const amountIn = getAmountIn(amountOut, reserveIn, reserveOut);
      
      // Should be roughly 0.5 ETH (plus fees)
      expect(Number(amountIn)).toBeGreaterThan(Number(ethers.parseUnits('0.5', 18)));
      expect(Number(amountIn)).toBeLessThan(Number(ethers.parseUnits('0.6', 18)));
    });

    it('should throw error for insufficient liquidity', () => {
      const amountOut = ethers.parseUnits('200001', 6); // More than reserve
      const reserveIn = ethers.parseUnits('100', 18);
      const reserveOut = ethers.parseUnits('200000', 6);
      
      expect(() => {
        getAmountIn(amountOut, reserveIn, reserveOut);
      }).toThrow('Insufficient liquidity');
    });

    it('should handle zero inputs correctly', () => {
      const reserveIn = ethers.parseUnits('100', 18);
      const reserveOut = ethers.parseUnits('200000', 6);
      
      expect(getAmountIn(0n, reserveIn, reserveOut)).toBe(1n); // Returns 1 for rounding
      expect(getAmountIn(BigInt('1000'), 0n, reserveOut)).toBe(0n);
      expect(getAmountIn(BigInt('1000'), reserveIn, 0n)).toBe(0n);
    });

    it('should be consistent with getAmountOut', () => {
      const reserveIn = ethers.parseUnits('100', 18);
      const reserveOut = ethers.parseUnits('200000', 6);
      const amountIn = ethers.parseUnits('1', 18);
      
      const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
      const calculatedAmountIn = getAmountIn(amountOut, reserveIn, reserveOut);
      
      // Should be approximately equal (within rounding)
      const difference = calculatedAmountIn > amountIn ? 
        calculatedAmountIn - amountIn : amountIn - calculatedAmountIn;
      expect(Number(difference)).toBeLessThan(1000); // Within 1000 wei
    });
  });

  describe('findOptimalAmount', () => {
    it('should find positive optimal amount for profitable arbitrage', () => {
      const reservesA = {
        reserve0: ethers.parseUnits('100', 18), // 100 ETH
        reserve1: ethers.parseUnits('200000', 6) // 200k USDC
      };
      const reservesB = {
        reserve0: ethers.parseUnits('100', 18), // 100 ETH  
        reserve1: ethers.parseUnits('210000', 6) // 210k USDC (higher price)
      };
      const maxAmount = ethers.parseUnits('10', 18); // 10 ETH max
      
      const optimalAmount = findOptimalAmount(reservesA, reservesB, maxAmount);
      
      expect(optimalAmount).toBeGreaterThan(0n);
      expect(optimalAmount).toBeLessThanOrEqual(maxAmount);
    });

    it('should return zero for unprofitable arbitrage', () => {
      const reservesA = {
        reserve0: ethers.parseUnits('100', 18),
        reserve1: ethers.parseUnits('200000', 6)
      };
      const reservesB = {
        reserve0: ethers.parseUnits('100', 18),
        reserve1: ethers.parseUnits('200000', 6) // Same price
      };
      const maxAmount = ethers.parseUnits('10', 18);
      
      const optimalAmount = findOptimalAmount(reservesA, reservesB, maxAmount);
      
      expect(optimalAmount).toBe(0n);
    });

    it('should handle different iteration counts', () => {
      const reservesA = {
        reserve0: ethers.parseUnits('100', 18),
        reserve1: ethers.parseUnits('200000', 6)
      };
      const reservesB = {
        reserve0: ethers.parseUnits('100', 18),
        reserve1: ethers.parseUnits('205000', 6)
      };
      const maxAmount = ethers.parseUnits('10', 18);
      
      const result5 = findOptimalAmount(reservesA, reservesB, maxAmount, 5);
      const result15 = findOptimalAmount(reservesA, reservesB, maxAmount, 15);
      
      // More iterations should give similar or better results
      expect(result15).toBeGreaterThanOrEqual(0n);
      expect(result5).toBeGreaterThanOrEqual(0n);
    });
  });

  describe('calculatePriceImpact', () => {
    it('should calculate price impact for normal trade', () => {
      const amountIn = ethers.parseUnits('1', 18); // 1 ETH
      const reserveIn = ethers.parseUnits('100', 18); // 100 ETH reserve
      const reserveOut = ethers.parseUnits('200000', 6); // 200k USDC reserve
      
      const priceImpact = calculatePriceImpact(amountIn, reserveIn, reserveOut);
      
      expect(priceImpact).toBeGreaterThan(0); // Should have positive price impact
      expect(priceImpact).toBeLessThan(5); // Should be reasonable for 1% of pool
    });

    it('should show higher impact for larger trades', () => {
      const reserveIn = ethers.parseUnits('100', 18);
      const reserveOut = ethers.parseUnits('200000', 6);
      
      const smallTrade = calculatePriceImpact(ethers.parseUnits('1', 18), reserveIn, reserveOut);
      const largeTrade = calculatePriceImpact(ethers.parseUnits('10', 18), reserveIn, reserveOut);
      
      expect(largeTrade).toBeGreaterThan(smallTrade);
    });

    it('should handle zero amount correctly', () => {
      const reserveIn = ethers.parseUnits('100', 18);
      const reserveOut = ethers.parseUnits('200000', 6);
      
      const priceImpact = calculatePriceImpact(0n, reserveIn, reserveOut);
      expect(priceImpact).toBe(0);
    });
  });
});