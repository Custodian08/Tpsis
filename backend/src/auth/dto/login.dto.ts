import { IsEmail, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  @IsNotEmpty()
  email: string;

  @IsString()
  @MaxLength(256)
  @IsNotEmpty()
  password: string;
}
