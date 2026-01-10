import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestEmailChangeDto {
  @IsEmail()
  newEmail!: string;
}

export class ConfirmEmailChangeDto {
  @IsNotEmpty()
  token!: string;
}
