const PurchaseItem = require('../models/PurchaseItem');

const PurchaseItemController = {
  // Create a line item (expects body with purchaseId, productId, productName, price, quantity, lineTotal?, image?)
  create(req, res) {
    PurchaseItem.create(req.body, (err, id) => {
      if (err) {
        console.error('PurchaseItemController.create error:', err);
        req.flash && req.flash('error', 'Unable to add purchase item.');
        return res.redirect('back');
      }
      req.flash && req.flash('success', 'Purchase item added.');
      return res.redirect('back');
    });
  },

  // List items for a purchase (returns JSON for reuse)
  listByPurchase(req, res) {
    const purchaseId = req.params.purchaseId || req.query.purchaseId;
    if (!purchaseId) return res.status(400).send('purchaseId required');

    PurchaseItem.listByPurchase(purchaseId, (err, items) => {
      if (err) {
        console.error('PurchaseItemController.listByPurchase error:', err);
        return res.status(500).send('Server error');
      }
      return res.json(items || []);
    });
  },

  // Delete a line item
  remove(req, res) {
    const id = req.params.id || req.body.purchaseItemId;
    if (!id) return res.status(400).send('purchaseItemId required');

    PurchaseItem.remove(id, (err) => {
      if (err) {
        console.error('PurchaseItemController.remove error:', err);
        req.flash && req.flash('error', 'Unable to delete purchase item.');
        return res.redirect('back');
      }
      req.flash && req.flash('success', 'Purchase item deleted.');
      return res.redirect('back');
    });
  }
};

module.exports = PurchaseItemController;
