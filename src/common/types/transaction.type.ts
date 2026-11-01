import { Currency } from './currency.type';

export type TransactionMetaData = Record<string, string>;
export type Transaction = {
  date: Date;
  reference: string;
  amount: number;
  metadata?: TransactionMetaData;
};

type TransferInfoType = {
  Reference: string;
  date: Date;
  amount: number;
  currency: Currency;
};

type SenderInfoType = {
  AccountNumber: string;
};

type ReceiverInfoType = {
  BankCode: string;
  AccountNumber: string;
  BenficiaryName: string;
};

type NotesType = {
  Note: string[];
};

enum HashType {
  SHA,
  RB,
}

export interface SendTransactionInterface {
  TransferInfo: TransferInfoType;
  SenderInfo: SenderInfoType;
  ReceiverInfo: ReceiverInfoType;
  Notes?: NotesType;
  PaymentType?: number;
  ChargeDetails?: HashType;
}
