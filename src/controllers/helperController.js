const prisma = require('../config/database');

// ============ WASHER CONTROLLER ============

/**
 * Create a new washer (automatically assigned to user's branch)
 */
const createWasher = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const branchId = req.user.branchId; // Get branch from authenticated user

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Washer name is required'
      });
    }

    // Check if washer with this name already exists in this branch
    const existingWasher = await prisma.washer.findFirst({
      where: {
        name,
        branchId
      }
    });

    if (existingWasher) {
      return res.status(400).json({
        success: false,
        message: 'A washer with this name already exists in your branch'
      });
    }

    // Create washer with branch assignment
    const washer = await prisma.washer.create({
      data: {
        name,
        phone,
        branchId
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Washer created successfully',
      data: washer
    });

  } catch (error) {
    console.error('Error creating washer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create washer',
      error: error.message
    });
  }
};

/**
 * Get all washers for user's branch
 */
const getAllWashers = async (req, res) => {
  try {
    const { isActive } = req.query;
    const branchId = req.user.branchId;

    const where = {
      branchId // Filter by user's branch
    };
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const washers = await prisma.washer.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: washers,
      count: washers.length
    });

  } catch (error) {
    console.error('Error fetching washers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch washers',
      error: error.message
    });
  }
};

/**
 * Get washer by ID (only if in user's branch)
 */
const getWasherById = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = req.user.branchId;

    const washer = await prisma.washer.findFirst({
      where: {
        id,
        branchId
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            location: true
          }
        },
        _count: {
          select: {
            carWashes: true,
            itemsWashed: true
          }
        }
      }
    });

    if (!washer) {
      return res.status(404).json({
        success: false,
        message: 'Washer not found in your branch'
      });
    }

    res.json({
      success: true,
      data: washer
    });

  } catch (error) {
    console.error('Error fetching washer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch washer',
      error: error.message
    });
  }
};

/**
 * Update washer (only if in user's branch)
 */
const updateWasher = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, isActive } = req.body;
    const branchId = req.user.branchId;

    // Verify washer belongs to user's branch
    const existingWasher = await prisma.washer.findFirst({
      where: { id, branchId }
    });

    if (!existingWasher) {
      return res.status(404).json({
        success: false,
        message: 'Washer not found in your branch'
      });
    }

    // If updating name, check if it already exists in this branch
    if (name && name !== existingWasher.name) {
      const duplicateWasher = await prisma.washer.findFirst({
        where: {
          name,
          branchId,
          id: { not: id }
        }
      });

      if (duplicateWasher) {
        return res.status(400).json({
          success: false,
          message: 'A washer with this name already exists in your branch'
        });
      }
    }

    const washer = await prisma.washer.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Washer updated successfully',
      data: washer
    });

  } catch (error) {
    console.error('Error updating washer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update washer',
      error: error.message
    });
  }
};

/**
 * Delete washer (soft delete by setting isActive to false)
 * Only if in user's branch
 */
const deleteWasher = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = req.user.branchId;

    // Verify washer belongs to user's branch
    const washer = await prisma.washer.findFirst({
      where: { id, branchId }
    });

    if (!washer) {
      return res.status(404).json({
        success: false,
        message: 'Washer not found in your branch'
      });
    }

    const updatedWasher = await prisma.washer.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Washer deactivated successfully',
      data: updatedWasher
    });

  } catch (error) {
    console.error('Error deleting washer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate washer',
      error: error.message
    });
  }
};

// ============ SERVICE ITEM CONTROLLER ============
// Service items are GLOBAL - shared across all branches

/**
 * Create a new service item (global, not branch-specific)
 */
const createServiceItem = async (req, res) => {
  try {
    const { name, description, price } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Service item name is required'
      });
    }

    // Convert price to number if it's a string
    const priceValue = price !== undefined ? parseFloat(price) : 0;

    if (isNaN(priceValue) || priceValue < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid positive number'
      });
    }

    const serviceItem = await prisma.serviceItem.create({
      data: {
        name,
        description,
        price: priceValue
      }
    });

    res.status(201).json({
      success: true,
      message: 'Service item created successfully',
      data: serviceItem
    });

  } catch (error) {
    console.error('Error creating service item:', error);
    
    // Handle unique constraint error
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'A service item with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create service item',
      error: error.message
    });
  }
};

/**
 * Get all service items (global, available to all branches)
 */
const getAllServiceItems = async (req, res) => {
  try {
    const { isActive } = req.query;

    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const serviceItems = await prisma.serviceItem.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        isActive: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      data: serviceItems,
      count: serviceItems.length
    });

  } catch (error) {
    console.error('Error fetching service items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service items',
      error: error.message
    });
  }
};

/**
 * Get service item by ID
 */
const getServiceItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const serviceItem = await prisma.serviceItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            washedItems: true
          }
        }
      }
    });

    if (!serviceItem) {
      return res.status(404).json({
        success: false,
        message: 'Service item not found'
      });
    }

    res.json({
      success: true,
      data: serviceItem
    });

  } catch (error) {
    console.error('Error fetching service item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service item',
      error: error.message
    });
  }
};

/**
 * Update service item
 */
const updateServiceItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, isActive } = req.body;

    // Validate price if provided
    if (price !== undefined) {
      const priceValue = parseFloat(price);
      if (isNaN(priceValue) || priceValue < 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a valid positive number'
        });
      }
    }

    const serviceItem = await prisma.serviceItem.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json({
      success: true,
      message: 'Service item updated successfully',
      data: serviceItem
    });

  } catch (error) {
    console.error('Error updating service item:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'A service item with this name already exists'
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Service item not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update service item',
      error: error.message
    });
  }
};

/**
 * Delete service item (soft delete)
 */
const deleteServiceItem = async (req, res) => {
  try {
    const { id } = req.params;

    const serviceItem = await prisma.serviceItem.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Service item deactivated successfully',
      data: serviceItem
    });

  } catch (error) {
    console.error('Error deleting service item:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Service item not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to deactivate service item',
      error: error.message
    });
  }
};

module.exports = {
  // Washer exports
  createWasher,
  getAllWashers,
  getWasherById,
  updateWasher,
  deleteWasher,
  
  // Service Item exports
  createServiceItem,
  getAllServiceItems,
  getServiceItemById,
  updateServiceItem,
  deleteServiceItem
};