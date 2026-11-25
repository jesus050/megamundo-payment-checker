"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto = __importStar(require("crypto"));
const prisma = new client_1.PrismaClient();
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}
async function main() {
    console.log('🌱 Iniciando seed de la base de datos Megamundo...');
    // 1. Business
    const business = await prisma.business.upsert({
        where: { id: '00000000-0000-0000-0000-000000000001' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Comercializadora Megamundo S.A.S.',
            status: 'ACTIVE',
        },
    });
    console.log('✅ Negocio asegurado:', business.name);
    // 2. Usuarios
    const adminPasswordHash = hashPassword('Admin123!');
    const cashierPasswordHash = hashPassword('Cajero123!');
    const viewerPasswordHash = hashPassword('Auditor123!');
    await prisma.user.upsert({
        where: { email: 'admin@megamundo.com' },
        update: { passwordHash: adminPasswordHash },
        create: {
            businessId: business.id,
            name: 'Administrador Megamundo',
            email: 'admin@megamundo.com',
            passwordHash: adminPasswordHash,
            role: 'ADMIN',
            status: 'ACTIVE',
        },
    });
    await prisma.user.upsert({
        where: { email: 'cajero@megamundo.com' },
        update: { passwordHash: cashierPasswordHash },
        create: {
            businessId: business.id,
            name: 'Cajero Principal',
            email: 'cajero@megamundo.com',
            passwordHash: cashierPasswordHash,
            role: 'CASHIER',
            status: 'ACTIVE',
        },
    });
    await prisma.user.upsert({
        where: { email: 'auditor@megamundo.com' },
        update: { passwordHash: viewerPasswordHash },
        create: {
            businessId: business.id,
            name: 'Auditor Financiero',
            email: 'auditor@megamundo.com',
            passwordHash: viewerPasswordHash,
            role: 'VIEWER',
            status: 'ACTIVE',
        },
    });
    console.log('✅ Usuarios creados: admin@megamundo.com, cajero@megamundo.com, auditor@megamundo.com');
    // 3. Cuentas de Pago
    const bancolombiaAccount = await prisma.paymentAccount.upsert({
        where: { id: '00000000-0000-0000-0000-000000000010' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000010',
            businessId: business.id,
            provider: 'BANCOLOMBIA',
            providerAccountId: 'CTA-BC-5027',
            alias: 'QR Bancolombia Caja Principal',
            lastFourDigits: '5027',
            status: 'ACTIVE',
        },
    });
    const mockAccount = await prisma.paymentAccount.upsert({
        where: { id: '00000000-0000-0000-0000-000000000011' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000011',
            businessId: business.id,
            provider: 'MOCK',
            providerAccountId: 'CTA-MOCK-5027',
            alias: 'QR Simulador Mock Caja',
            lastFourDigits: '5027',
            status: 'ACTIVE',
        },
    });
    console.log('✅ Cuentas de pago registradas:', bancolombiaAccount.alias, '|', mockAccount.alias);
    // 4. Ventas iniciales preparadas
    await prisma.sale.upsert({
        where: {
            businessId_saleNumber: {
                businessId: business.id,
                saleNumber: 'MM-1058',
            },
        },
        update: {},
        create: {
            businessId: business.id,
            saleNumber: 'MM-1058',
            amount: 185000,
            currency: 'COP',
            status: 'PENDING',
        },
    });
    await prisma.sale.upsert({
        where: {
            businessId_saleNumber: {
                businessId: business.id,
                saleNumber: 'MM-1059',
            },
        },
        update: {},
        create: {
            businessId: business.id,
            saleNumber: 'MM-1059',
            amount: 75500,
            currency: 'COP',
            status: 'PENDING',
        },
    });
    console.log('✅ Ventas preparadas: MM-1058 ($185.000) y MM-1059 ($75.500)');
    console.log('🎉 Seed completado exitosamente.');
}
main()
    .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map