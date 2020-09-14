import { getCustomRepository, getRepository, In } from 'typeorm';
import fs from 'fs';
import csvParse from 'csv-parse';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const categoryRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const contactsReadStream = fs.createReadStream(filePath);

    const parser = csvParse({
      delimiter: ',',
      from_line: 2,
    });

    const parseCsv = contactsReadStream.pipe(parser);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCsv.on('data', line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCsv.on('end', resolve));

    const existentCategories = await categoryRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitle = existentCategories.map(
      (category: Category) => category.title,
    );

    const newCategoriesTitle = categories
      .filter(category => !existentCategoriesTitle.includes(category))
      .filter((value, index, self) => self.indexOf(value) == index);

    const addedCategories = categoryRepository.create(
      newCategoriesTitle.map(title => ({ title })),
    );

    await categoryRepository.save(addedCategories);

    const allCategories = [...addedCategories, ...existentCategories];

    const createdTransactions = transactionsRepository.create(
      transactions.map(transactionLoop => ({
        title: transactionLoop.title,
        type: transactionLoop.type,
        value: transactionLoop.value,
        category: allCategories.find(
          category => category.title === transactionLoop.category,
        ),
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
