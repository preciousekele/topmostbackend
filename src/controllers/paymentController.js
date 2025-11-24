const prisma = require('../config/database');

/**
 * Calculate payment split for a service item
 * Regular items: 60% company, 40% washer
 * Special items (engine, radiator, condenser): (amount/3)*2 company, amount/3 washer
 * Rug: 50% company, 50% washer
 * 
 * Note: Special items are ALWAYS credited to "idowu" regardless of who washed them
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
 * Get daily payment summary for all washers (branch-specific)
 * Note: Special items (engine, radiator, condenser) are always credited to "idowu"
 */
const getDailyPaymentSummary = async (req, res) => {
  try {
    const { date } = req.query;
    const branchId = req.user.branchId;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all washed items for the day with related data (filtered by branch)
    const washedItems = await prisma.washedItem.findMany({
      where: {
        carWash: {
          branchId, // Filter by branch
          washDate: {
            gte: startOfDay,
            lte: endOfDay
          }
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
        serviceItem: {
          select: {
            id: true,
            name: true,
            price: true
          }
        },
        carWash: {
          select: {
            id: true,
            carNumber: true,
            carModel: true,
            washDate: true
          }
        }
      }
    });

    // Calculate payment summary per washer
    const washerSummaries = {};
    let totalCompanyEarnings = 0;
    let totalWasherEarnings = 0;
    let totalSales = 0;
    const uniqueCars = new Set();

    washedItems.forEach(item => {
      const washerId = item.washer.id;
      const washerName = item.washer.name;
      const washerPhone = item.washer.phone;
      const price = item.price || item.serviceItem.price; // FIXED: Check item.price first
      const serviceItemName = item.serviceItem.name;
      const carWashId = item.carWash.id;

      // Track unique cars
      uniqueCars.add(carWashId);

      // Initialize washer summary if not exists
      if (!washerSummaries[washerId]) {
        washerSummaries[washerId] = {
          washerId,
          washerName,
          washerPhone,
          totalAmount: 0,
          washerEarnings: 0,
          companyEarnings: 0,
          itemsWashed: 0,
          carsWashed: new Set(),
          items: []
        };
      }

      // Calculate split
      const { companyShare, washerShare } = calculatePaymentSplit(serviceItemName, price);

      // Update washer summary
      washerSummaries[washerId].totalAmount += price;
      washerSummaries[washerId].washerEarnings += washerShare;
      washerSummaries[washerId].companyEarnings += companyShare;
      washerSummaries[washerId].itemsWashed += 1;
      washerSummaries[washerId].carsWashed.add(carWashId);
      washerSummaries[washerId].items.push({
        carNumber: item.carWash.carNumber,
        serviceItem: serviceItemName,
        price,
        washerShare,
        companyShare
      });

      // Update totals
      totalSales += price;
      totalCompanyEarnings += companyShare;
      totalWasherEarnings += washerShare;
    });

    // Convert washer summaries to array and format
    const washerPayments = Object.values(washerSummaries).map(summary => ({
      washerId: summary.washerId,
      washerName: summary.washerName,
      washerPhone: summary.washerPhone,
      totalAmount: Math.round(summary.totalAmount * 100) / 100,
      washerEarnings: Math.round(summary.washerEarnings * 100) / 100,
      companyEarnings: Math.round(summary.companyEarnings * 100) / 100,
      itemsWashed: summary.itemsWashed,
      carsWashed: summary.carsWashed.size,
      items: summary.items
    }));

    // Sort by total earnings (descending)
    washerPayments.sort((a, b) => b.washerEarnings - a.washerEarnings);

    res.json({
      success: true,
      data: {
        branch: req.user.branch,
        date: targetDate.toISOString().split('T')[0],
        summary: {
          totalSales: Math.round(totalSales * 100) / 100,
          totalCompanyEarnings: Math.round(totalCompanyEarnings * 100) / 100,
          totalWasherEarnings: Math.round(totalWasherEarnings * 100) / 100,
          totalCarsWashed: uniqueCars.size,
          totalItemsWashed: washedItems.length
        },
        washerPayments
      }
    });

  } catch (error) {
    console.error('Error fetching daily payment summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily payment summary',
      error: error.message
    });
  }
};

/**
 * Get payment summary for a specific washer (branch-specific)
 * Note: If washer is "idowu", this will include all special items
 */
const getWasherPaymentSummary = async (req, res) => {
  try {
    const { washerId } = req.params;
    const { date } = req.query;
    const branchId = req.user.branchId;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch washer details (verify branch)
    const washer = await prisma.washer.findFirst({
      where: { 
        id: washerId,
        branchId
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true
      }
    });

    if (!washer) {
      return res.status(404).json({
        success: false,
        message: 'Washer not found in your branch'
      });
    }

    // Fetch all washed items for this washer on the specified date
    const washedItems = await prisma.washedItem.findMany({
      where: {
        washerId,
        carWash: {
          branchId, // Ensure branch filter
          washDate: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      },
      include: {
        serviceItem: {
          select: {
            id: true,
            name: true,
            price: true
          }
        },
        carWash: {
          select: {
            id: true,
            carNumber: true,
            carModel: true,
            customerName: true,
            washDate: true
          }
        }
      }
    });

    // Calculate payment summary
    let totalAmount = 0;
    let washerEarnings = 0;
    let companyEarnings = 0;
    const carsWashed = new Set();
    const items = [];

    washedItems.forEach(item => {
      const price = item.price || item.serviceItem.price; // FIXED: Check item.price first
      const serviceItemName = item.serviceItem.name;
      const { companyShare, washerShare } = calculatePaymentSplit(serviceItemName, price);

      totalAmount += price;
      washerEarnings += washerShare;
      companyEarnings += companyShare;
      carsWashed.add(item.carWash.id);

      items.push({
        carNumber: item.carWash.carNumber,
        carModel: item.carWash.carModel,
        customerName: item.carWash.customerName,
        serviceItem: serviceItemName,
        price,
        washerShare,
        companyShare,
        washDate: item.carWash.washDate
      });
    });

    res.json({
      success: true,
      data: {
        washer: {
          id: washer.id,
          name: washer.name,
          phone: washer.phone
        },
        branch: req.user.branch,
        date: targetDate.toISOString().split('T')[0],
        summary: {
          totalAmount: Math.round(totalAmount * 100) / 100,
          washerEarnings: Math.round(washerEarnings * 100) / 100,
          companyEarnings: Math.round(companyEarnings * 100) / 100,
          itemsWashed: washedItems.length,
          carsWashed: carsWashed.size
        },
        items
      }
    });

  } catch (error) {
    console.error('Error fetching washer payment summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch washer payment summary',
      error: error.message
    });
  }
};

/**
 * Get company payment summary for a date (branch-specific)
 */
const getCompanyPaymentSummary = async (req, res) => {
  try {
    const { date } = req.query;
    const branchId = req.user.branchId;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all car wash records for the day (filtered by branch)
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

    // Fetch all washed items for the day (filtered by branch)
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

    // Calculate payment method totals from carWash records
    carWashRecords.forEach(record => {
      if (record.paymentMethod) {
        const method = record.paymentMethod.toLowerCase();
        if (method === 'cash' || method === 'transfer') {
          paymentMethods[method] += record.totalAmount;
        }
      }
    });

    // Calculate earnings from washed items
    washedItems.forEach(item => {
      const price = item.price || item.serviceItem.price; // FIXED: Check item.price first
      const serviceItemName = item.serviceItem.name;
      const { companyShare, washerShare } = calculatePaymentSplit(serviceItemName, price);

      totalSales += price;
      companyEarnings += companyShare;
      washerEarnings += washerShare;
    });

    res.json({
      success: true,
      data: {
        branch: req.user.branch,
        date: targetDate.toISOString().split('T')[0],
        summary: {
          totalSales: Math.round(totalSales * 100) / 100,
          companyEarnings: Math.round(companyEarnings * 100) / 100,
          washerEarnings: Math.round(washerEarnings * 100) / 100,
          totalCarsWashed: carWashRecords.length,
          totalItemsWashed: washedItems.length
        },
        paymentMethods: {
          cash: Math.round(paymentMethods.cash * 100) / 100,
          transfer: Math.round(paymentMethods.transfer * 100) / 100
        }
      }
    });

  } catch (error) {
    console.error('Error fetching company payment summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company payment summary',
      error: error.message
    });
  }
};

module.exports = {
  getDailyPaymentSummary,
  getWasherPaymentSummary,
  getCompanyPaymentSummary
};