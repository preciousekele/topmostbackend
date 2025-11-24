const prisma = require('../config/database');

/**
 * Calculate payment split for a service item
 * Regular items: 60% company, 40% washer
 * Special items (engine, radiator, condenser): (amount/3)*2 company, amount/3 washer
 * Rug: 50% company, 50% washer
 * 
 * Note: Special items (engine, radiator, condenser) are ALWAYS credited to "idowu" regardless of who washed them
 * Note: Rug has 50/50 split and is credited to the assigned washer
 */
const calculatePaymentSplit = (serviceItemName, price) => {
  const specialItems = ['engine', 'radiator', 'condenser'];
  const isSpecialItem = specialItems.some(item => 
    serviceItemName.toLowerCase().includes(item)
  );
  
  const isRug = serviceItemName.toLowerCase().includes('rug');

  if (isSpecialItem) {
    const washerShare = price / 3;
    const companyShare = (price / 3) * 2;
    return { companyShare, washerShare };
  } else if (isRug) {
    const washerShare = price * 0.5;
    const companyShare = price * 0.5;
    return { companyShare, washerShare };
  } else {
    const companyShare = price * 0.6;
    const washerShare = price * 0.4;
    return { companyShare, washerShare };
  }
};

/**
 * Check if service item is a special item (engine, radiator, condenser)
 * Note: Rug is NOT included here as it doesn't require Idowu assignment
 */
const isSpecialItem = (serviceItemName) => {
  const specialItems = ['engine', 'radiator', 'condenser'];
  return specialItems.some(item => 
    serviceItemName.toLowerCase().includes(item)
  );
};

const createCarWashRecord = async (req, res) => {
  try {
    const { carNumber, carModel, customerName, customerPhone, paymentMethod, items } = req.body;
    const branchId = req.user.branchId;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one service item must be provided'
      });
    }

    // Validate payment method
    if (paymentMethod && !['cash', 'transfer'].includes(paymentMethod.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Payment method must be either "cash" or "transfer"'
      });
    }

    // Extract unique washer and service item names
    const washerNames = [...new Set(items.map(item => item.washerName))];
    const serviceItemNames = [...new Set(items.map(item => item.serviceItemName))];

    // Fetch washers and service items by name (washers filtered by branch)
    const [washers, serviceItems] = await Promise.all([
      prisma.washer.findMany({
        where: { 
          name: { in: washerNames }, 
          isActive: true,
          branchId
        }
      }),
      prisma.serviceItem.findMany({
        where: { name: { in: serviceItemNames }, isActive: true }
      })
    ]);

    // Find "idowu" washer in this branch for special items
    const IdowuWasher = await prisma.washer.findFirst({
      where: {
        name: { equals: 'Idowu', mode: 'insensitive' },
        branchId,
        isActive: true
      }
    });

    // Check if there are special items but no idowu in this branch
    const hasSpecialItems = items.some(item => isSpecialItem(item.serviceItemName));
    if (hasSpecialItems && !IdowuWasher) {
      return res.status(400).json({
        success: false,
        message: 'Special items (Engine, Radiator, Condenser) require washer "Idowu" to be active in your branch'
      });
    }

    // Create name-to-id maps
    const washerMap = Object.fromEntries(washers.map(w => [w.name, w.id]));
    const serviceItemMap = Object.fromEntries(
      serviceItems.map(s => [s.name, { id: s.id, price: s.price }])
    );

    // Validate all washers exist in this branch
    const missingWashers = washerNames.filter(name => !washerMap[name]);
    if (missingWashers.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Washers not found, inactive, or not in your branch: ${missingWashers.join(', ')}`
      });
    }

    // Validate all service items exist
    const missingServiceItems = serviceItemNames.filter(name => !serviceItemMap[name]);
    if (missingServiceItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Service items not found or inactive: ${missingServiceItems.join(', ')}`
      });
    }

    // Validate variable pricing items
    const itemsWithMissingPrices = [];
    for (const item of items) {
      const serviceItemData = serviceItemMap[item.serviceItemName];
      
      // If service item has price = 0 (variable pricing), custom price is required
      if (serviceItemData.price === 0) {
        if (!item.customPrice || item.customPrice <= 0) {
          itemsWithMissingPrices.push(item.serviceItemName);
        }
      }
    }

    if (itemsWithMissingPrices.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Custom price required for variable pricing items: ${itemsWithMissingPrices.join(', ')}`,
        detail: 'These items require a "customPrice" field with a value greater than 0'
      });
    }

    // Convert items to use IDs and calculate total amount
    // IMPORTANT: Special items (engine, radiator, condenser) are assigned to idowu, not the original washer
    const itemsWithIds = items.map(item => {
      const serviceItemName = item.serviceItemName;
      const serviceItemData = serviceItemMap[serviceItemName];
      
      // Use custom price if provided and service item has variable pricing (price = 0)
      // Otherwise use the fixed price from service item
      const finalPrice = serviceItemData.price === 0 && item.customPrice 
        ? parseFloat(item.customPrice) 
        : serviceItemData.price;
      
      // If special item (engine, radiator, condenser), assign to idowu
      // Otherwise use the specified washer (including Rug which goes to assigned washer)
      const actualWasherId = isSpecialItem(serviceItemName) 
        ? IdowuWasher.id 
        : washerMap[item.washerName];

      return {
        washerId: actualWasherId,
        serviceItemId: serviceItemData.id,
        price: finalPrice,
        originalWasherName: item.washerName,
        actualWasherName: isSpecialItem(serviceItemName) ? 'Idowu' : item.washerName
      };
    });

    // Calculate total amount
    const totalAmount = itemsWithIds.reduce((sum, item) => sum + item.price, 0);

    // Get all unique washer IDs involved (including idowu for special items)
    const allInvolvedWasherIds = [...new Set(itemsWithIds.map(item => item.washerId))];

    // Create car wash record with all related data in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the car wash record with branch assignment
      const carWash = await tx.carWash.create({
        data: {
          branchId,
          carNumber,
          carModel,
          customerName,
          customerPhone,
          paymentMethod,
          totalAmount,
          washedItems: {
            create: itemsWithIds.map(item => ({
              washerId: item.washerId,
              serviceItemId: item.serviceItemId,
              price: item.price
            }))
          },
          washers: {
            connect: allInvolvedWasherIds.map(id => ({ id }))
          }
        },
        include: {
          washedItems: {
            include: {
              washer: true,
              serviceItem: true
            }
          },
          washers: true,
          branch: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });

      // 2. Update daily summaries for each washer
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count items per washer
      const washerItemCounts = itemsWithIds.reduce((acc, item) => {
        acc[item.washerId] = (acc[item.washerId] || 0) + 1;
        return acc;
      }, {});

      // Check if washer was already involved in a car today
      const washerCarInvolvement = {};
      
      for (const washerId of allInvolvedWasherIds) {
        const existingCarWashes = await tx.carWash.findMany({
          where: {
            branchId,
            washDate: { gte: today },
            washers: { some: { id: washerId } }
          },
          select: { id: true }
        });
        washerCarInvolvement[washerId] = !existingCarWashes.some(cw => cw.id === carWash.id);
      }

      for (const washerId of allInvolvedWasherIds) {
        await tx.dailySummary.upsert({
          where: {
            washerId_date_branchId: {
              washerId,
              date: today,
              branchId
            }
          },
          update: {
            totalCarsWashed: {
              increment: washerCarInvolvement[washerId] ? 1 : 0
            },
            totalItemsWashed: {
              increment: washerItemCounts[washerId] || 0
            }
          },
          create: {
            washerId,
            branchId,
            date: today,
            totalCarsWashed: washerCarInvolvement[washerId] ? 1 : 0,
            totalItemsWashed: washerItemCounts[washerId] || 0
          }
        });
      }

      // 3. Update company daily summary for this branch
      await tx.companyDailySummary.upsert({
        where: { 
          branchId_date: { 
            branchId,
            date: today 
          }
        },
        update: {
          totalCarsWashed: { increment: 1 },
          totalItemsWashed: { increment: itemsWithIds.length }
        },
        create: {
          branchId,
          date: today,
          totalCarsWashed: 1,
          totalItemsWashed: itemsWithIds.length
        }
      });

      return carWash;
    });

    res.status(201).json({
      success: true,
      message: 'Car wash record created successfully',
      data: result
    });

  } catch (error) {
    console.error('Error creating car wash record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create car wash record',
      error: error.message
    });
  }
};

/**
 * Get daily summary for a specific washer in user's branch
 */
const getWasherDailySummary = async (req, res) => {
  try {
    const { washerId } = req.params;
    const { date } = req.query;
    const branchId = req.user.branchId;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Verify washer belongs to user's branch
    const washer = await prisma.washer.findFirst({
      where: { id: washerId, branchId }
    });

    if (!washer) {
      return res.status(404).json({
        success: false,
        message: 'Washer not found in your branch'
      });
    }

    const summary = await prisma.dailySummary.findUnique({
      where: {
        washerId_date_branchId: {
          washerId,
          date: targetDate,
          branchId
        }
      },
      include: {
        washer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'No summary found for this washer on the specified date'
      });
    }

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error fetching washer daily summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch washer daily summary',
      error: error.message
    });
  }
};

/**
 * Get company daily summary with items breakdown for user's branch
 */
const getCompanyDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const branchId = req.user.branchId;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all car wash records for the day in this branch
    const carWashRecords = await prisma.carWash.findMany({
      where: {
        branchId,
        washDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      select: {
        id: true,
        totalAmount: true,
        paymentMethod: true
      }
    });

    // Fetch all washed items for the day in this branch
    const washedItems = await prisma.washedItem.findMany({
      where: {
        carWash: {
          branchId,
          washDate: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      },
      include: {
        serviceItem: {
          select: {
            name: true,
            price: true
          }
        }
      }
    });

    let totalSales = 0;
    let companyEarnings = 0;
    let washerEarnings = 0;
    const paymentMethods = {
      cash: 0,
      transfer: 0
    };

    // Group items by service item name and calculate
    const itemsSummary = {};

    // Calculate payment method totals from carWash records
    carWashRecords.forEach(record => {
      if (record.paymentMethod) {
        const method = record.paymentMethod.toLowerCase();
        if (method === 'cash' || method === 'transfer') {
          paymentMethods[method] += record.totalAmount;
        }
      }
    });

    // Calculate earnings and group items
    // NOTE: For variable pricing items (like Rug), use the stored price from washedItem
    washedItems.forEach(item => {
      // Use the stored price if available (for variable pricing), otherwise use service item price
      const price = item.price || item.serviceItem.price;
      const serviceItemName = item.serviceItem.name;
      const { companyShare, washerShare } = calculatePaymentSplit(serviceItemName, price);

      totalSales += price;
      companyEarnings += companyShare;
      washerEarnings += washerShare;

      // Group by item name
      if (!itemsSummary[serviceItemName]) {
        itemsSummary[serviceItemName] = {
          itemName: serviceItemName,
          quantity: 0,
          totalEarnings: 0,
          companyEarning: 0,
          workerShare: 0
        };
      }

      itemsSummary[serviceItemName].quantity += 1;
      itemsSummary[serviceItemName].totalEarnings += price;
      itemsSummary[serviceItemName].companyEarning += companyShare;
      itemsSummary[serviceItemName].workerShare += washerShare;
    });

    // Convert to array and round values
    const itemsWashed = Object.values(itemsSummary).map(item => ({
      itemName: item.itemName,
      quantity: item.quantity,
      totalEarnings: Math.round(item.totalEarnings * 100) / 100,
      companyEarning: Math.round(item.companyEarning * 100) / 100,
      workerShare: Math.round(item.workerShare * 100) / 100
    }));

    // Sort by total earnings (descending)
    itemsWashed.sort((a, b) => b.totalEarnings - a.totalEarnings);

    res.json({
      success: true,
      data: {
        branch: req.user.branch,
        date: targetDate.toISOString().split('T')[0],
        summary: {
          totalEarnings: Math.round(totalSales * 100) / 100,
          companyShare: Math.round(companyEarnings * 100) / 100,
          workerShare: Math.round(washerEarnings * 100) / 100,
          totalJobs: carWashRecords.length,
          totalItemsWashed: washedItems.length
        },
        itemsWashed,
        paymentMethods: {
          cash: Math.round(paymentMethods.cash * 100) / 100,
          transfer: Math.round(paymentMethods.transfer * 100) / 100
        }
      }
    });

  } catch (error) {
    console.error('Error fetching company daily summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company daily summary',
      error: error.message
    });
  }
};

/**
 * Get all washers' daily summaries for user's branch
 */
const getAllWashersDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const branchId = req.user.branchId;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const summaries = await prisma.dailySummary.findMany({
      where: { 
        date: targetDate,
        branchId
      },
      include: {
        washer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        totalItemsWashed: 'desc'
      }
    });

    res.json({
      success: true,
      data: summaries
    });

  } catch (error) {
    console.error('Error fetching all washers daily summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch washers daily summary',
      error: error.message
    });
  }
};

/**
 * Get detailed car wash records for a date in user's branch
 */
const getCarWashRecords = async (req, res) => {
  try {
    const { date, washerId } = req.query;
    const branchId = req.user.branchId;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const whereClause = {
      branchId,
      washDate: {
        gte: startOfDay,
        lte: endOfDay
      }
    };

    if (washerId) {
      // Verify washer belongs to this branch
      const washer = await prisma.washer.findFirst({
        where: { id: washerId, branchId }
      });

      if (!washer) {
        return res.status(400).json({
          success: false,
          message: 'Washer not found in your branch'
        });
      }

      whereClause.washers = {
        some: { id: washerId }
      };
    }

    const records = await prisma.carWash.findMany({
      where: whereClause,
      include: {
        washedItems: {
          include: {
            washer: {
              select: {
                id: true,
                name: true
              }
            },
            serviceItem: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true
              }
            }
          }
        },
        washers: {
          select: {
            id: true,
            name: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        washDate: 'desc'
      }
    });

    res.json({
      success: true,
      data: records,
      count: records.length
    });

  } catch (error) {
    console.error('Error fetching car wash records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car wash records',
      error: error.message
    });
  }
};

/**
 * Get company daily summary for ALL branches (Super Admin only)
 * @route GET /api/records/company-summary-all
 */
const getCompanyDailySummaryAllBranches = async (req, res) => {
  try {
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all branches
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        location: true
      },
      orderBy: { name: 'asc' }
    });

    // Fetch data for each branch
    const branchSummaries = await Promise.all(
      branches.map(async (branch) => {
        // Fetch car wash records for this branch
        const carWashRecords = await prisma.carWash.findMany({
          where: {
            branchId: branch.id,
            washDate: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          select: {
            id: true,
            totalAmount: true,
            paymentMethod: true
          }
        });

        // Fetch washed items for this branch
        const washedItems = await prisma.washedItem.findMany({
          where: {
            carWash: {
              branchId: branch.id,
              washDate: {
                gte: startOfDay,
                lte: endOfDay
              }
            }
          },
          include: {
            serviceItem: {
              select: {
                name: true,
                price: true
              }
            }
          }
        });

        let totalSales = 0;
        let companyEarnings = 0;
        let washerEarnings = 0;
        const paymentMethods = { cash: 0, transfer: 0 };
        const itemsSummary = {};

        // Calculate payment methods
        carWashRecords.forEach(record => {
          if (record.paymentMethod) {
            const method = record.paymentMethod.toLowerCase();
            if (method === 'cash' || method === 'transfer') {
              paymentMethods[method] += record.totalAmount;
            }
          }
        });

        // Calculate earnings and group items
        // NOTE: For variable pricing items (like Rug), use the stored price from washedItem
        washedItems.forEach(item => {
          // Use the stored price if available (for variable pricing), otherwise use service item price
          const price = item.price || item.serviceItem.price;
          const serviceItemName = item.serviceItem.name;
          const { companyShare, washerShare } = calculatePaymentSplit(serviceItemName, price);

          totalSales += price;
          companyEarnings += companyShare;
          washerEarnings += washerShare;

          if (!itemsSummary[serviceItemName]) {
            itemsSummary[serviceItemName] = {
              itemName: serviceItemName,
              quantity: 0,
              totalEarnings: 0,
              companyEarning: 0,
              workerShare: 0
            };
          }

          itemsSummary[serviceItemName].quantity += 1;
          itemsSummary[serviceItemName].totalEarnings += price;
          itemsSummary[serviceItemName].companyEarning += companyShare;
          itemsSummary[serviceItemName].workerShare += washerShare;
        });

        const itemsWashed = Object.values(itemsSummary).map(item => ({
          itemName: item.itemName,
          quantity: item.quantity,
          totalEarnings: Math.round(item.totalEarnings * 100) / 100,
          companyEarning: Math.round(item.companyEarning * 100) / 100,
          workerShare: Math.round(item.workerShare * 100) / 100
        }));

        itemsWashed.sort((a, b) => b.totalEarnings - a.totalEarnings);

        return {
          branch,
          summary: {
            totalEarnings: Math.round(totalSales * 100) / 100,
            companyShare: Math.round(companyEarnings * 100) / 100,
            workerShare: Math.round(washerEarnings * 100) / 100,
            totalJobs: carWashRecords.length,
            totalItemsWashed: washedItems.length
          },
          itemsWashed,
          paymentMethods: {
            cash: Math.round(paymentMethods.cash * 100) / 100,
            transfer: Math.round(paymentMethods.transfer * 100) / 100
          }
        };
      })
    );

    // Calculate overall totals
    const overallTotals = branchSummaries.reduce((acc, branch) => {
      acc.totalEarnings += branch.summary.totalEarnings;
      acc.companyShare += branch.summary.companyShare;
      acc.workerShare += branch.summary.workerShare;
      acc.totalJobs += branch.summary.totalJobs;
      acc.totalItemsWashed += branch.summary.totalItemsWashed;
      acc.cash += branch.paymentMethods.cash;
      acc.transfer += branch.paymentMethods.transfer;
      return acc;
    }, {
      totalEarnings: 0,
      companyShare: 0,
      workerShare: 0,
      totalJobs: 0,
      totalItemsWashed: 0,
      cash: 0,
      transfer: 0
    });

    res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        branches: branchSummaries,
        overallTotals: {
          totalEarnings: Math.round(overallTotals.totalEarnings * 100) / 100,
          companyShare: Math.round(overallTotals.companyShare * 100) / 100,
          workerShare: Math.round(overallTotals.workerShare * 100) / 100,
          totalJobs: overallTotals.totalJobs,
          totalItemsWashed: overallTotals.totalItemsWashed,
          cash: Math.round(overallTotals.cash * 100) / 100,
          transfer: Math.round(overallTotals.transfer * 100) / 100
        }
      }
    });

  } catch (error) {
    console.error('Error fetching company daily summary for all branches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company daily summary',
      error: error.message
    });
  }
};

/**
 * Get a single car wash record by ID (only if in user's branch)
 */
const getCarWashById = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = req.user.branchId;

    const record = await prisma.carWash.findFirst({
      where: { 
        id,
        branchId
      },
      include: {
        washedItems: {
          include: {
            washer: {
              select: {
                id: true,
                name: true,
                phone: true
              }
            },
            serviceItem: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true
              }
            }
          }
        },
        washers: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            location: true
          }
        }
      }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Car wash record not found in your branch'
      });
    }

    res.json({
      success: true,
      data: record
    });

  } catch (error) {
    console.error('Error fetching car wash record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car wash record',
      error: error.message
    });
  }
};

module.exports = {
  createCarWashRecord,
  getWasherDailySummary,
  getCompanyDailySummary,
  getAllWashersDailySummary,
  getCarWashRecords,
  getCarWashById,
  getCompanyDailySummaryAllBranches 
};