import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const MOBILE_PATTERN = /^\+?[1-9]\d{7,14}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export class RegisterDto {
  @ApiProperty({ example: 'Syed Amir' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'syed@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: '+60123456789', description: 'E.164 or local format mobile number' })
  @IsString()
  @Matches(MOBILE_PATTERN, { message: 'mobile must be a valid phone number (e.g. +60123456789)' })
  mobile!: string;

  @ApiProperty({ example: 'Str0ngPass!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: 'password must contain at least one letter and one number' })
  password!: string;
}
