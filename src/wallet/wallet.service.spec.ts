import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { RAW_1OOO_TRANSACTIONS } from './raw_1000_transactions';
import { performance } from 'node:perf_hooks';
import { getRepositoryToken } from '@nestjs/typeorm';
import { XmlService } from 'src/xml/xml.service';
import { Wallet } from './entities/wallet.entity';

describe('WalletService', () => {
  let service: WalletService;
  const raw_transactions = RAW_1OOO_TRANSACTIONS;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,

        {
          provide: XmlService,
          useValue: {
            build: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it(`should benchmark parsing 1000 transactions`, () => {
    const transactions = raw_transactions
      .trim()
      .split(/\r?\n/)
      .filter((c) => c !== '');

    const start = performance.now();
    const parsed = transactions.map((transaction) =>
      service.parseTransaction(transaction),
    );
    const end = performance.now();
    expect(parsed).toHaveLength(transactions.length);
    const executionTime = end - start;
    console.log({
      transactions: parsed.length,
      executionTime: `${executionTime.toFixed(2)} ms`,
      throughput: `${(parsed.length / (executionTime / 1000)).toFixed(
        2,
      )} transactions/sec`,
    });
  });
});
