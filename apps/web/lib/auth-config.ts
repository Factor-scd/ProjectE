import bcrypt from 'bcryptjs';
import { count, eq } from 'drizzle-orm';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db, users } from '@project-e/db';
import { seedDefaultData } from './seed';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (!user) {
          const [{ total }] = await db.select({ total: count() }).from(users);
          const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
          const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
          if (total === 0 && email === initialEmail && password === initialPassword) {
            [user] = await db.insert(users).values({
              email,
              name: process.env.INITIAL_ADMIN_NAME || email,
              passwordHash: await bcrypt.hash(password, 12),
            }).returning();

            // Seed default workspace + welcome note on first user creation
            await seedDefaultData();
          }
        }

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
  pages: { signIn: '/login' },
};
