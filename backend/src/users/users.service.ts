import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: RegisterDto): Promise<User> {
    const email = createUserDto.email.trim().toLowerCase();
    const existingUser = await this.usersRepository.createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email })
      .getOne();

    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    if (Buffer.byteLength(createUserDto.password, 'utf8') > 72) {
      throw new BadRequestException('Пароль не должен превышать 72 байта в кодировке UTF-8');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);
    const user = this.usersRepository.create({
      email,
      fullName: createUserDto.fullName.trim(),
      password: hashedPassword,
      role: 'user',
    });

    const savedUser = await this.usersRepository.save(user);
    return Array.isArray(savedUser) ? savedUser[0] : savedUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  async getPublicProfile(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
