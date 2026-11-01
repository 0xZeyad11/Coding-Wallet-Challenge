import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Currency } from 'src/common/types/currency.type';

class TransferInfoDto {
  @IsNotEmpty()
  @IsString()
  Reference: string;

  @Type(() => Date)
  @IsNotEmpty()
  @IsDate()
  date: Date;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsEnum(Currency)
  currency: Currency;
}

class SenderInfoDto {
  @IsNotEmpty()
  @IsString()
  AccountNumber: string;
}

class ReceiverInfoDto {
  @IsNotEmpty()
  @IsString()
  BankCode: string;

  @IsNotEmpty()
  @IsString()
  AccountNumber: string;

  @IsNotEmpty()
  @IsString()
  BenficiaryName: string;
}

class NotesDto {
  @IsArray()
  @IsString({ each: true })
  Note: string[];
}

export class SendTransactionDto {
  @ValidateNested()
  @Type(() => TransferInfoDto)
  TransferInfo: TransferInfoDto;

  @ValidateNested()
  @Type(() => SenderInfoDto)
  SenderInfo: SenderInfoDto;

  @ValidateNested()
  @Type(() => ReceiverInfoDto)
  ReceiverInfo: ReceiverInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotesDto)
  Notes?: NotesDto;

  @IsOptional()
  @IsNumber()
  PaymentType?: number;

  @IsString()
  @IsOptional()
  ChargeDetails?: string;
}
