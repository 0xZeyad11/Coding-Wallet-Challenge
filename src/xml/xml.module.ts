import { Module } from '@nestjs/common';
import { XmlService } from './xml.service';

@Module({
  providers: [XmlService],
})
export class XmlModule {}
