import { FastifyInstance } from 'fastify';
import { prisma } from '@megamundo/database';
import { LoginSchema, UserRoleType } from '@megamundo/shared';
import { verifyPassword } from '@megamundo/shared/crypto';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: process.env.NODE_ENV === 'test' ? 100 : 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Datos de inicio de sesión inválidos',
        issues: parseResult.error.errors,
      });
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { business: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Credenciales inválidas o usuario inactivo',
      });
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Credenciales inválidas',
      });
    }

    const token = fastify.jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRoleType,
        businessId: user.businessId,
      },
      { expiresIn: '12h' }
    );

    return reply.send({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        business: {
          id: user.business.id,
          name: user.business.name,
        },
      },
    });
  });

  fastify.get(
    '/api/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          businessId: true,
          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Usuario no encontrado',
        });
      }

      return reply.send({ user });
    }
  );
}
