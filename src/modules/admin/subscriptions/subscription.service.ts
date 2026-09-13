import {
    prisma,
  } from "../../../lib/prisma.js";
  
  export const subscriptionService = {
    async listAll() {
      const businesses =
        await prisma.business.findMany({
          orderBy: {
            createdAt: "desc",
          },
  
          select: {
            id: true,
            name: true,
            logoUrl: true,
            createdAt: true,
  
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                status: true,
              },
            },
  
            subscriptions: {
              orderBy: {
                createdAt: "desc",
              },
  
              take: 1,
  
              select: {
                id: true,
                plan: true,
                status: true,
                startsAt: true,
                expiresAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
  
            _count: {
              select: {
                stores: true,
              },
            },
          },
        });
  
      return businesses.map(
        (business) => ({
          business: {
            id:
              business.id,
  
            name:
              business.name,
  
            logoUrl:
              business.logoUrl,
  
            createdAt:
              business.createdAt,
          },
  
          customer: {
            id:
              business.owner.id,
  
            name:
              business.owner.name,
  
            email:
              business.owner.email,
  
            status:
              business.owner.status,
          },
  
          subscription:
            business
              .subscriptions[0] ??
            null,
  
          locationsCount:
            business._count
              .stores,
        })
      );
    },
  };