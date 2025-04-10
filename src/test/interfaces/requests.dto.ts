import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsNumber, IsInt } from 'class-validator';
import { Provider } from 'src/llm/interfaces';

export class TestLLMRequestDto {
  @ApiProperty({
    example: Provider.OpenAI,
    description: 'Select an LLM model',
  })
  @IsEnum(Provider)
  @IsNotEmpty()
  provider: Provider;

  @IsString()
  @IsNotEmpty()
  message: string;
}

export class GoogleSearchRequestDto {
  @IsString()
  @IsNotEmpty()
  searchQuery: string;

  @IsNumber()
  @IsInt()
  pageNumber: number;
}

export class CollaborativeLLMRequestDto {
  @ApiProperty({
    example: 'What is the best approach to solve climate change?',
    description: 'The question or topic for the LLMs to debate',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({
    example: 3,
    description: 'Number of debate rounds between the LLMs',
  })
  @IsInt()
  @IsNotEmpty()
  rounds: number;
}
