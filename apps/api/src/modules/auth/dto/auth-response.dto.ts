export class AuthResponseDto {
  declare accessToken: string;
  declare refreshToken: string;
  declare user: {
    id: string;
    email: string;
    name: string;
  };
}
