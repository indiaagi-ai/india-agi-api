import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GoogleSearchRequest {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'brihas.co',
  })
  query: string;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    example: 0,
  })
  pageNumber: number;
}
