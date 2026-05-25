# SALES INVOICE ENHANCEMENTS - IMPLEMENTATION PLAN

## Current State
The existing InvoiceModal has basic functionality:
- Manual customer name entry (free text)
- Product selection with quantity and price
- Basic total calculation
- Simple invoice header (number, date, type)

## Required Enhancements

### 1. Customer Management
**Current**: Free text input for customer name
**Required**: 
- Searchable dropdown with customer list
- Auto-fill customer details when selected:
  - Location
  - Route
  - Salesperson
  - Credit limit
  - Outstanding balance

**Implementation**:
```typescript
// Add state for customers and selected customer
const [customers, setCustomers] = useState<any[]>([]);
const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
const [customerSearch, setCustomerSearch] = useState('');

// Fetch customers on modal open
const fetchCustomers = async () => {
  const { data } = await supabase
    .from('customers')
    .select('id, name, location, route_id, salesperson_id, balance, credit_limit')
    .order('name');
  setCustomers(data || []);
};

// Auto-fill when customer selected
const handleCustomerSelect = (customer: any) => {
  setSelectedCustomer(customer);
  setCustomerName(customer.name);
  setCustomerLocation(customer.location);
  setRouteId(customer.route_id);
  setSalespersonId(customer.salesperson_id);
};
```

### 2. Product Line Items Enhancements
**Current**: Basic product, quantity, price
**Required**:
- Batch number selection per product
- Discount field per line item
- Damaged product checkbox
- Gifted product checkbox
- Auto-calculate line total
- Stock availability check

**Implementation**:
```typescript
// Enhanced item structure
const [items, setItems] = useState<any[]>([]);

// Add new item with all fields
const handleAddItem = () => {
  setItems([...items, {
    product_id: '',
    quantity: 1,
    unit_price: 0,
    discount_amount: 0,
    total_price: 0,
    batch_number: '',
    is_damaged: false,
    is_gifted: false,
    notes: ''
  }]);
};

// Update item with calculations
const handleUpdateItem = (index: number, field: string, value: any) => {
  const newItems = [...items];
  newItems[index] = { ...newItems[index], [field]: value };
  
  // Recalculate total
  const qty = Number(newItems[index].quantity) || 0;
  const price = Number(newItems[index].unit_price) || 0;
  const discount = Number(newItems[index].discount_amount) || 0;
  newItems[index].total_price = (qty * price) - discount;
  
  setItems(newItems);
};
```

### 3. Invoice Header Enhancements
**Current**: Basic fields
**Required**:
- Discount field (overall invoice discount)
- Clear payment type (Cash/Credit)
- Customer location display
- Route display
- Salesperson display

**Implementation**:
```typescript
// Add new state variables
const [discountAmount, setDiscountAmount] = useState(0);
const [customerLocation, setCustomerLocation] = useState('');
const [routeId, setRouteId] = useState('');
const [salespersonId, setSalespersonId] = useState('');

// Calculate totals with discount
const subtotal = useMemo(() => 
  items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0), [items]);

const totalAmount = useMemo(() => 
  Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);
```

### 4. Business Logic Implementation

**Stock Validation**:
```typescript
// Before saving invoice
const validateStock = async () => {
  for (const item of items) {
    if (item.is_damaged || item.is_gifted) continue; // Skip stock check for damaged/gifted
    
    const { data: product } = await supabase
      .from('products')
      .select('stock_quantity, name')
      .eq('id', item.product_id)
      .single();
      
    if (!product || product.stock_quantity < item.quantity) {
      throw new Error(`Insufficient stock for ${product?.name || 'product'}`);
    }
  }
};
```

**Revenue Calculation**:
```typescript
// Only count non-damaged, non-gifted items in revenue
const revenueItems = items.filter(item => !item.is_damaged && !item.is_gifted);
const revenueSubtotal = revenueItems.reduce((sum, item) => 
  sum + (Number(item.total_price) || 0), 0);
```

### 5. UI Layout Changes

**Customer Section**:
```jsx
<div className="invoice-grid">
  {/* Customer Selection */}
  <div className="invoice-field full-width">
    <label>Customer *</label>
    <CustomerSearchDropdown
      customers={customers}
      onSelect={handleCustomerSelect}
      value={customerSearch}
      onChange={setCustomerSearch}
    />
  </div>
  
  {/* Auto-filled Customer Info */}
  {selectedCustomer && (
    <div className="customer-info-grid">
      <div className="info-item">
        <label>Location:</label>
        <span>{customerLocation}</span>
      </div>
      <div className="info-item">
        <label>Route:</label>
        <span>{routeName}</span>
      </div>
      <div className="info-item">
        <label>Salesperson:</label>
        <span>{salespersonName}</span>
      </div>
      <div className="info-item">
        <label>Credit Limit:</label>
        <span>{formatCurrency(creditLimit)}</span>
      </div>
      <div className="info-item">
        <label>Current Balance:</label>
        <span>{formatCurrency(outstandingBalance)}</span>
      </div>
    </div>
  )}
</div>
```

**Line Items Section**:
```jsx
<div className="line-items-section">
  <div className="line-item-header">
    <h4>Line Items ({items.length})</h4>
    <button onClick={handleAddItem}>Add Item</button>
  </div>
  
  {items.map((item, index) => (
    <div key={index} className="line-item-row">
      {/* Product Selection */}
      <div className="item-field product">
        <label>Product *</label>
        <select value={item.product_id} onChange={...}>
          <option value="">Select product...</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
          ))}
        </select>
      </div>
      
      {/* Quantity */}
      <div className="item-field quantity">
        <label>Qty *</label>
        <input type="number" value={item.quantity} onChange={...} min="1" />
      </div>
      
      {/* Unit Price */}
      <div className="item-field price">
        <label>Price *</label>
        <input type="number" value={item.unit_price} onChange={...} min="0" step="0.01" />
      </div>
      
      {/* Discount */}
      <div className="item-field discount">
        <label>Discount</label>
        <input type="number" value={item.discount_amount} onChange={...} min="0" step="0.01" />
      </div>
      
      {/* Batch Number */}
      <div className="item-field batch">
        <label>Batch #</label>
        <input type="text" value={item.batch_number} onChange={...} placeholder="Batch" />
      </div>
      
      {/* Damaged Checkbox */}
      <div className="item-field checkbox">
        <label>
          <input type="checkbox" checked={item.is_damaged} onChange={...} />
          Damaged
        </label>
      </div>
      
      {/* Gifted Checkbox */}
      <div className="item-field checkbox">
        <label>
          <input type="checkbox" checked={item.is_gifted} onChange={...} />
          Gift
        </label>
      </div>
      
      {/* Total */}
      <div className="item-field total">
        <label>Total</label>
        <input type="text" value={item.total_price.toFixed(2)} readOnly />
      </div>
      
      {/* Remove Button */}
      <button onClick={() => handleRemoveItem(index)}>
        <Trash2 size={16} />
      </button>
    </div>
  ))}
</div>
```

### 6. Data Flow

**On Customer Select**:
1. Fetch customer details (location, route_id, salesperson_id, balance, credit_limit)
2. Auto-fill location, route, salesperson fields
3. Display credit information
4. Check if customer exceeds credit limit (show warning)

**On Product Select**:
1. Fetch product details (unit_price, stock_quantity, batch_numbers)
2. Auto-fill unit price (editable)
3. Check stock availability
4. Show available batch numbers

**On Save**:
1. Validate all required fields
2. Check stock for all non-damaged/non-gifted items
3. Calculate revenue (excluding damaged/gifted)
4. Save invoice header
5. Save line items
6. Update customer balance
7. Reduce stock (trigger-based)
8. Generate PDF (existing functionality)

### 7. Validation Rules

**Customer**:
- Required: Customer must be selected from dropdown
- Credit Check: If credit limit exceeded, show warning but allow (manager override)

**Line Items**:
- Required: Product, Quantity, Unit Price
- Minimum: Quantity > 0, Price >= 0
- Stock: Must have sufficient stock (unless damaged/gifted)
- Batch: Required for controlled drugs

**Invoice**:
- Required: At least one line item
- Required: Customer, Date, Payment Type
- Totals: Must be positive

### 8. Error Handling

```typescript
// Comprehensive error messages
try {
  await validateStock();
  await onSave(invoiceData);
} catch (error: any) {
  if (error.message.includes('Insufficient stock')) {
    toast.error(`Stock Error: ${error.message}. Please check product availability.`);
  } else if (error.message.includes('Credit limit')) {
    toast.error(`Credit Warning: ${error.message}`, {
      action: {
        label: 'Override',
        onClick: () => handleSaveWithOverride()
      }
    });
  } else {
    toast.error(`Save Error: ${error.message}`);
  }
}
```

### 9. Performance Considerations

- **Debounced Search**: Customer search with 300ms debounce
- **Memoized Calculations**: Use useMemo for totals, customer info
- **Selective Fetching**: Only fetch products when needed
- **Batch Operations**: Save all line items in single transaction
- **Optimistic Updates**: Update UI immediately, rollback on error

### 10. Testing Scenarios

1. **Create Invoice with New Customer**:
   - Select existing customer
   - Verify auto-fill works
   - Add multiple products
   - Apply discounts
   - Save and verify all data

2. **Credit Limit Warning**:
   - Select customer near/exceeding credit limit
   - Verify warning appears
   - Test override functionality

3. **Stock Validation**:
   - Try to sell more than available stock
   - Verify error message
   - Test with damaged/gifted items (should bypass stock check)

4. **Revenue Calculation**:
   - Create invoice with damaged and gifted items
   - Verify they don't count toward revenue
   - Check stock is still reduced

5. **Payment Types**:
   - Create cash sale (immediate payment)
   - Create credit sale (deferred payment)
   - Verify correct status and balance updates

## Implementation Priority

1. **Phase 1**: Customer dropdown with auto-fill
2. **Phase 2**: Enhanced line items (batch, discount, flags)
3. **Phase 3**: Stock validation and business rules
4. **Phase 4**: UI polish and error handling
5. **Phase 5**: Testing and edge cases
