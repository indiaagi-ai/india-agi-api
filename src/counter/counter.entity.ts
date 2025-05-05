import {
  Entity,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', name: 'visitor_id' })
  visitorId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'login_time' })
  loginTime: Date;
}

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  question: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'asked_time' })
  askedTime: Date;
}

@Entity('shares')
export class Share {
  @PrimaryGeneratedColumn() id: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'shared_time' })
  sharedTime: Date;
}
