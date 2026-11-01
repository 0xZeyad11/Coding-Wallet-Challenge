import { Injectable } from '@nestjs/common';
import { Builder } from 'xml2js';

@Injectable()
export class XmlService {
  build(data: object): string {
    return new Builder({ rootName: 'PaymentRequestMessage' }).buildObject(data);
  }
}
