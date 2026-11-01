import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ReceiveTransactionDTO } from './dto/recieveTransaction.dto';
import { validate } from 'class-validator';
import { SendTransactionDto } from './dto/sendTransaction.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('recieve')
  async RecieveTransaction(@Body() body: string) {
    if (!body) {
      throw new BadRequestException(`Request should be a plain text`);
    }
    const dto = new ReceiveTransactionDTO();
    dto.content = body;
    // split each new line based on CRLF
    const transactions = dto.content
      .trim()
      .split(/\r?\n/)
      .filter((c) => c !== '');
    const errors = await validate(dto);
    if (errors.length > 0) {
      const errorMessages = errors.flatMap((err) =>
        Object.values(err.constraints || {}),
      );
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: errorMessages,
      });
    }
    const res = await this.walletService.recieveTransaction(transactions);
    return {
      status: 'Success',
      length: res.length,
      transaction: res,
    };
  }

  @Post('send')
  SendTransaction(@Body() payload: SendTransactionDto) {
    return this.walletService.sendTransaction(payload);
  }
}
