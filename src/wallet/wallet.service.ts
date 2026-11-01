import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Transaction,
  TransactionMetaData,
} from 'src/common/types/transaction.type';
import { DateConverter } from 'src/common/utils/DateConverter';
import { XmlService } from 'src/xml/xml.service';
import { In, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { SendTransactionDto } from './dto/sendTransaction.dto';

@Injectable()
export class WalletService {
  constructor(
    private readonly xmlService: XmlService,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  async recieveTransaction(transactions: string[]): Promise<Wallet[]> {
    // i should silently ignore the duplicated transactions while inserting the new ones
    const parsed_transactions: Transaction[] = transactions.map((t) =>
      this.parseTransaction(t),
    );
    const parsed_references: string[] = parsed_transactions.map(
      (t) => t.reference,
    );
    // check for duplicates in one query
    const existing_transactions = await this.walletRepo.find({
      where: { reference: In(parsed_references) },
    });

    // ignore the duplicates of existing transacation if there any in the request
    const existing_transactions_map = new Set(
      existing_transactions.map((transaction) => transaction.reference),
    );

    const unique_transactions: Transaction[] = parsed_transactions.filter(
      (t) => !existing_transactions_map.has(t.reference),
    );
    const new_transactions = unique_transactions.map((transaction) =>
      this.walletRepo.create({
        date: transaction.date,
        reference: transaction.reference,
        amount: transaction.amount,
        notes: transaction.metadata,
      }),
    );
    if (new_transactions.length === 0) return [];
    const result = await this.walletRepo
      .createQueryBuilder()
      .insert()
      .into(Wallet)
      .values(new_transactions)
      .orIgnore()
      .returning('*')
      .execute();
    const res = result.raw as Wallet[];
    return res.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  sendTransaction(payload: SendTransactionDto): string {
    // optional values are set to undefined and then removed from the payload
    if (payload.PaymentType === 99) payload.PaymentType = undefined;
    if (payload.ChargeDetails === 'SHA') payload.ChargeDetails = undefined;
    if (payload.Notes && payload.Notes.Note.length === 0)
      payload.Notes = undefined;
    const res = Object.fromEntries(
      Object.entries(payload).filter(
        ([key, value]) => value != null || value != undefined,
      ),
    );
    return this.xmlService.build(res);
  }

  parseTransaction(transaction_raw: string): Transaction {
    if (transaction_raw.includes('#')) {
      return this.parsePayTechBank(transaction_raw);
    }
    return this.parseAcmeBank(transaction_raw);
  }

  private parseAcmeBank(transaction_raw: string): Transaction {
    const transaction_text = transaction_raw.split('//');
    const amount = Number(transaction_text[0].replace(',', '.') ?? 0);
    const reference = transaction_text[1];
    const date = DateConverter(transaction_text[2]);
    const transaction_obj: Transaction = {
      date,
      reference,
      amount,
    };
    return transaction_obj;
  }
  private parsePayTechBank(transaction_raw: string): Transaction {
    const transaction_text = transaction_raw.split('#');
    const date = transaction_text[0].slice(0, 8);
    const amount = Number(transaction_text[0].slice(8).replace(',', '.'));
    const reference = transaction_text[1];
    const metadata = this.parseMetadata(transaction_text[2]);
    const transaction_obj: Transaction = {
      date: DateConverter(date),
      reference,
      amount,
      metadata,
    };

    return transaction_obj;
  }

  private parseMetadata(transaction_meta: string): TransactionMetaData {
    const metadata: TransactionMetaData = {};
    const metadata_text = transaction_meta.split('/');
    if (metadata_text.length % 2 != 0) {
      throw new BadRequestException(`Invalid transaction metadata`);
    }
    for (let i = 0; i < metadata_text.length; i += 2) {
      const key = metadata_text[i];
      const value = metadata_text[i + 1];
      if (!key || !value) {
        throw new BadRequestException(`Invalid Request Metadata`);
      }
      metadata[key] = value;
    }
    return metadata;
  }
}
