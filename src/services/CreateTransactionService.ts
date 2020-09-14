import { getCustomRepository, getRepository } from 'typeorm';
// import AppError from '../errors/AppError';

import TransactionsRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import AppError from '../errors/AppError';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactonRepostory = getCustomRepository(TransactionsRepository);

    const balance = await transactonRepostory.getBalance();
    if (type === 'outcome' && balance.total < value) {
      throw new AppError('Not enough balance to process this transaction');
    }

    const categoryRepository = getRepository(Category);
    let transactionCategory = await categoryRepository.findOne({
      where: {
        title: category,
      },
    });
    if (!transactionCategory) {
      transactionCategory = categoryRepository.create({ title: category });
      await categoryRepository.save(transactionCategory);
    }

    const transaction = transactonRepostory.create({
      title,
      value,
      type,
      category: transactionCategory,
    });

    await transactonRepostory.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
