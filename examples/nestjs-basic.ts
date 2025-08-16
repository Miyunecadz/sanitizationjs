import { Module, Controller, Post, Body, Get, Param } from '@nestjs/common';
import { IsEmail, IsString, IsOptional } from 'class-validator';
import { 
  SanitizationModule, 
  Sanitize, 
  Normalize,
  DEFAULT_CONFIG 
} from '../src';

class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  bio?: string;
}

@Controller('users')
export class UsersController {
  
  @Post()
  @Sanitize({ 
    rules: ['html', 'trim', 'email-normalize'],
    strictMode: true 
  })
  @Normalize({ 
    format: 'detailed',
    includeLinks: true 
  })
  async createUser(@Body() userData: CreateUserDto) {
    // Simulate user creation
    return {
      id: Math.floor(Math.random() * 1000),
      ...userData,
      createdAt: new Date().toISOString()
    };
  }

  @Get(':id')
  @Normalize({ format: 'standard' })
  async getUser(@Param('id') id: string) {
    return {
      id: parseInt(id),
      name: 'John Doe',
      email: 'john@example.com',
      bio: 'Software Developer'
    };
  }
}

@Module({
  imports: [
    SanitizationModule.forRoot({
      ...DEFAULT_CONFIG,
      sanitization: {
        ...DEFAULT_CONFIG.sanitization,
        strictMode: true,
        logViolations: true
      },
      normalization: {
        ...DEFAULT_CONFIG.normalization,
        format: 'standard',
        includeMetadata: true
      }
    })
  ],
  controllers: [UsersController]
})
export class AppModule {}