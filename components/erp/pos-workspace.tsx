"use client";

import { ArrowLeftRight, Check, Minus, Plus, Search, Trash2, UserRound, WalletCards, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../primitives/button";
import { Field, Modal, SelectField } from "../primitives/primitives";
import { formatCurrency, type Product } from "../../lib/erp-data";
import { useErpStore } from "../../lib/erp-store";
import type { ExchangeFormValues, SaleFormValues } from "../../lib/validations";

type PosMode = "sale" | "exchange" | "buyback";
type CartLine = SaleFormValues["items"][number];

function nextCustomerCode(customers: Array<{ code: string }>) {
  let index = customers.length + 1;
  let code = `CUST-${String(index).padStart(3, "0")}`;
  while (customers.some((customer) => customer.code === code)) code = `CUST-${String(++index).padStart(3, "0")}`;
  return code;
}

function fallbackProductImagePath(product: Product) {
  const categoryImages: Record<string, string> = {
    Mobiles: "/products/mobile.png",
    Audio: "/products/headphone.png",
    Smartwatches: "/products/smartwatch.png",
    Tablets: "/products/tablet.png",
    Chargers: "/products/charger.png",
    Cables: "/products/cable.png",
    Accessories: "/products/accessories.png",
  };
  return categoryImages[product.category] ?? "/products/accessories.png";
}

function ProductImage({ product }: { product: Product }) {
  return <Image src={fallbackProductImagePath(product)} alt={`${product.category} category illustration`} width={120} height={150} className="pos-product-image" />;
}

export function PosWorkspace() {
  const { products, customers, suppliers, hydrated, addSale, addExchange } = useErpStore();
  const router = useRouter();
  const [mode, setMode] = useState<PosMode>("sale");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerContactNumber, setCustomerContactNumber] = useState("");
  const [customerCode, setCustomerCode] = useState(() => nextCustomerCode(customers));
  const [orderDiscount, setOrderDiscount] = useState("0");
  const [givenProductId, setGivenProductId] = useState("");
  const [givenQuantity, setGivenQuantity] = useState("1");
  const [tradeInUnitValue, setTradeInUnitValue] = useState("0");
  const [receivedProductId, setReceivedProductId] = useState("");
  const [receivedQuantity, setReceivedQuantity] = useState("1");
  const [receivedUnitSellingPrice, setReceivedUnitSellingPrice] = useState("0");
  const [receiveSource, setReceiveSource] = useState<"inventory" | "supplier">("inventory");
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierContactNumber, setSupplierContactNumber] = useState("");
  const [supplierCompany, setSupplierCompany] = useState("");
  const [supplierUnitCost, setSupplierUnitCost] = useState("0");
  const [supplierPaidAmount, setSupplierPaidAmount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const availableCategories = useMemo(() => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort((left, right) => left.localeCompare(right)), [products]);
  const activeCategory = category === "All categories" || availableCategories.includes(category) ? category : "All categories";

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = activeCategory === "All categories" || product.category === activeCategory;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${product.name} ${product.sku} ${product.color} ${product.brand ?? ""}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  }), [products, activeCategory, search]);

  const tradeInTotal = (Number(givenQuantity) || 0) * (Number(tradeInUnitValue) || 0);
  const replacementTotal = (Number(receivedQuantity) || 0) * (Number(receivedUnitSellingPrice) || 0);
  const exchangeBalance = replacementTotal - tradeInTotal;
  const cartSubtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitSellingPrice, 0);
  const cartDiscount = Math.min(cartSubtotal, Math.max(0, Number(orderDiscount) || 0));
  const cartTotal = Math.max(0, cartSubtotal - cartDiscount);
  const discountedCart = useMemo(() => {
    return cart.map((item) => {
      const lineSubtotal = item.quantity * item.unitSellingPrice;
      const lineDiscount = cartSubtotal > 0 ? cartDiscount * (lineSubtotal / cartSubtotal) : 0;
      return { ...item, discount: Math.min(lineSubtotal, lineDiscount) };
    });
  }, [cart, cartDiscount, cartSubtotal]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!givenProductId && products[0]) {
        setGivenProductId(products[0].id);
        setTradeInUnitValue(String(products[0].costPrice));
      }
      if (!receivedProductId && products[1]) {
        setReceivedProductId(products[1].id);
        setReceivedUnitSellingPrice(String(products[1].sellingPrice));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [products, givenProductId, receivedProductId]);

  const resetCustomer = () => {
    setCustomerId("");
    setCustomerName("");
    setCustomerContactNumber("");
    setCustomerCode(nextCustomerCode(customers));
  };

  const selectCustomer = (value: string) => {
    if (value === "__new_customer__") {
      resetCustomer();
      return;
    }
    const customer = customers.find((item) => item.id === value);
    if (!customer) return;
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerContactNumber(customer.contactNumber);
    setCustomerCode(customer.code);
  };

  const selectGivenProduct = (value: string) => {
    const product = products.find((item) => item.id === value);
    setGivenProductId(value);
    setTradeInUnitValue(String(product?.costPrice ?? 0));
  };

  const selectReceivedProduct = (value: string) => {
    const product = products.find((item) => item.id === value);
    setReceivedProductId(value);
    setReceivedUnitSellingPrice(String(product?.sellingPrice ?? 0));
    setSupplierUnitCost(String(product?.costPrice ?? 0));
  };

  const addToCart = (product: Product) => {
    if (product.inStockQuantity <= 0) return;
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) return current.map((item) => item.productId === product.id ? { ...item, quantity: Math.min(product.inStockQuantity, item.quantity + 1) } : item);
      return [...current, { productId: product.id, quantity: 1, unitSellingPrice: product.sellingPrice, discount: 0 }];
    });
    setError(null);
  };

  const changeQuantity = (product: Product, quantity: number) => setCart((current) => current.map((item) => item.productId === product.id ? { ...item, quantity: Math.max(1, Math.min(product.inStockQuantity, quantity)) } : item));
  const removeFromCart = (productId: string) => setCart((current) => current.filter((item) => item.productId !== productId));
  const decreaseQuantity = (product: Product) => {
    const item = cart.find((entry) => entry.productId === product.id);
    if (!item) return;
    if (item.quantity <= 1) removeFromCart(product.id);
    else changeQuantity(product, item.quantity - 1);
  };

  const handleProductAction = (product: Product) => {
    if (mode === "sale") addToCart(product);
    if (mode === "buyback") selectGivenProduct(product.id);
    if (mode === "exchange") selectReceivedProduct(product.id);
  };

  const submitSale = () => {
    if (!cart.length) { setError("Add at least one in-stock product to the order."); return; }
    const result = addSale({ customerId: customerId || undefined, customerName, customerContactNumber, customerCode, items: discountedCart });
    if (!result.ok) { setError(result.message); setSuccess(null); return; }
    setCart([]);
    setOrderDiscount("0");
    setError(null);
    setSuccess("Sale completed and inventory updated.");
    setCheckoutOpen(false);
  };

  const submitExchange = () => {
    const values: ExchangeFormValues = {
      mode: mode as "exchange" | "buyback",
      customerId: customerId || undefined,
      customerName,
      customerContactNumber,
      customerCode,
      givenProductId,
      givenQuantity: Number(givenQuantity),
      tradeInUnitValue: Number(tradeInUnitValue),
      receivedProductId: mode === "exchange" ? receivedProductId : undefined,
      receivedQuantity: mode === "exchange" ? Number(receivedQuantity) : undefined,
      receivedUnitSellingPrice: mode === "exchange" ? Number(receivedUnitSellingPrice) : undefined,
      receiveSource: mode === "exchange" ? receiveSource : undefined,
      supplierId: supplierId || undefined,
      supplierName,
      supplierContactNumber,
      supplierCompany,
      supplierUnitCost: Number(supplierUnitCost),
      supplierPaidAmount: Number(supplierPaidAmount),
    };
    const result = addExchange(values);
    if (!result.ok) { setError(result.message); setSuccess(null); return; }
    setError(null);
    setSuccess(mode === "buyback" ? "Buyback recorded and phone added to inventory." : "Exchange completed and inventory updated.");
  };

  const customerOptions = [<option key="new-customer" value="__new_customer__">+ New customer</option>, ...customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)];

  return <div className="erp-content pos-page">
    <div className="erp-page-heading"><div><p className="erp-eyebrow">Counter workspace</p><h1 className="erp-page-title">Point of Sale</h1><p className="erp-page-subtitle">Complete sales and customer buybacks from one screen.</p></div></div>
    <div className="pos-mode-search-row">
    </div>
    <div className="pos-layout">
      <section className="pos-catalog-panel">
        <div className="pos-catalog-toolbar"><div className="pos-category-tabs" aria-label="Product categories"><button type="button" className={activeCategory === "All categories" ? "is-active" : ""} onClick={() => setCategory("All categories")}>All products</button>{availableCategories.map((item) => <button type="button" className={activeCategory === item ? "is-active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><label className="pos-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, color, or SKU..." aria-label="Search products" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear product search"><X size={14} /></button>}</label></div>
        {!hydrated ? <div className="pos-empty-state">Loading products...</div> : filteredProducts.length ? <div className="pos-product-grid">{filteredProducts.map((product) => { const inCart = cart.find((item) => item.productId === product.id); const quantity = inCart?.quantity ?? 0; const actionLabel = mode === "exchange" ? "Use as replacement" : "Select phone"; return <article className={`pos-product-card ${product.inStockQuantity <= 0 ? "is-out-of-stock" : ""}`} key={product.id}><div className="pos-product-art"><ProductImage product={product} /></div><div className="pos-product-copy"><h2>{product.name}</h2><p>{product.color || "Unspecified"} · {product.category}</p><strong>{formatCurrency(product.sellingPrice)}</strong></div>{mode === "sale" ? <div className="pos-card-quantity-control" aria-label={`Quantity for ${product.name}`}><button type="button" disabled={quantity === 0} onClick={() => decreaseQuantity(product)} aria-label={`Decrease ${product.name} quantity`}><Minus size={14} /></button><span>{quantity}</span><button type="button" disabled={product.inStockQuantity <= 0 || quantity >= product.inStockQuantity} onClick={() => quantity === 0 ? addToCart(product) : changeQuantity(product, quantity + 1)} aria-label={`Increase ${product.name} quantity`}><Plus size={14} /></button></div> : <button type="button" disabled={product.inStockQuantity <= 0} onClick={() => handleProductAction(product)}><Plus size={14} />{actionLabel}</button>}</article>; })}</div> : <div className="pos-empty-state pos-product-empty-state"><Image src="/cart-icon.png" alt="" width={58} height={58} className="pos-empty-cart-image" /><strong>{products.length ? "No products found" : "Add your first product"}</strong><span>{products.length ? "Try another search or category." : "Create a product to start building your inventory."}</span>{!products.length && <Button type="button" variant="brand" onClick={() => router.push("/inventory?modal=add")}><Plus size={14} />Add product</Button>}</div>}
      </section>
    </div>
    <aside className="pos-order-panel soft-card dashboard-low-stock-card">
        <div className="pos-order-header"><div><p className="erp-eyebrow">Current transaction</p><h2>{mode === "sale" ? "Order details" : mode === "exchange" ? "Exchange details" : "Buyback details"}</h2></div><span className="pos-cart-count">{mode === "sale" ? `${cart.length} item${cart.length === 1 ? "" : "s"}` : "POS"}</span></div>
        <div className="pos-order-scroll">
          <section className="pos-section"><div className="pos-section-title"><UserRound size={15} /><h3>Customer</h3></div><SelectField label="Customer" searchable value={customerId || "__new_customer__"} onChange={(event) => selectCustomer(event.target.value)}>{customerOptions}</SelectField><div className="pos-customer-fields"><Field label="Name" value={customerName} readOnly={Boolean(customerId)} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" /><Field label="Contact" value={customerContactNumber} readOnly={Boolean(customerId)} onChange={(event) => setCustomerContactNumber(event.target.value)} placeholder="0300 1234567" /></div></section>
          {mode === "sale" ? <SaleOrder cart={cart} products={products} onRemove={removeFromCart} /> : <TradeInOrder mode={mode} products={products} suppliers={suppliers} givenProductId={givenProductId} givenQuantity={givenQuantity} tradeInUnitValue={tradeInUnitValue} receivedProductId={receivedProductId} receivedQuantity={receivedQuantity} receivedUnitSellingPrice={receivedUnitSellingPrice} receiveSource={receiveSource} supplierId={supplierId} supplierName={supplierName} supplierContactNumber={supplierContactNumber} supplierCompany={supplierCompany} supplierUnitCost={supplierUnitCost} supplierPaidAmount={supplierPaidAmount} onGivenProduct={selectGivenProduct} onGivenQuantity={setGivenQuantity} onTradeInValue={setTradeInUnitValue} onReceivedProduct={selectReceivedProduct} onReceivedQuantity={setReceivedQuantity} onSellingPrice={setReceivedUnitSellingPrice} onReceiveSource={setReceiveSource} onSupplier={setSupplierId} onSupplierName={setSupplierName} onSupplierContact={setSupplierContactNumber} onSupplierCompany={setSupplierCompany} onSupplierCost={setSupplierUnitCost} onSupplierPaid={setSupplierPaidAmount} />}
        </div>
        {success && <div className="pos-feedback pos-feedback-success"><Check size={14} />{success}</div>}
        {error && <div className="pos-feedback pos-feedback-error"><X size={14} />{error}</div>}
        <div className="pos-order-footer">{mode === "sale" ? <><div className="pos-total-row"><span>Subtotal</span><strong>{formatCurrency(cartSubtotal)}</strong></div><div className="pos-total-row pos-discount-summary"><label htmlFor="pos-order-discount">Discount</label><input id="pos-order-discount" type="number" min={0} max={cartSubtotal} value={orderDiscount} onChange={(event) => setOrderDiscount(event.target.value)} aria-label="Order discount" /></div><div className="pos-total-row pos-grand-total"><span>Total</span><strong>{formatCurrency(cartTotal)}</strong></div><Button variant="brand" className="pos-complete-button" disabled={!hydrated || !cart.length} onClick={() => { setError(null); setCheckoutOpen(true); }}><WalletCards size={16} />Complete sale</Button></> : <><div className="pos-total-row"><span>{mode === "buyback" ? "Customer payout" : exchangeBalance >= 0 ? "Customer pays" : "Customer credit"}</span><strong>{formatCurrency(mode === "buyback" ? tradeInTotal : Math.abs(exchangeBalance))}</strong></div><Button variant="brand" className="pos-complete-button" disabled={!hydrated} onClick={submitExchange}>{mode === "buyback" ? "Record buyback" : "Complete exchange"}</Button></>}</div>
      </aside>
    <Modal open={checkoutOpen} title="Confirm sale" description="Review the order before updating inventory and recording the transaction." onClose={() => setCheckoutOpen(false)}><div className="pos-confirmation"><div className="pos-confirmation-items">{discountedCart.map((item) => { const product = products.find((entry) => entry.id === item.productId); return <div key={item.productId}><span>{product?.name ?? "Product"} × {item.quantity}</span><strong>{formatCurrency(item.quantity * item.unitSellingPrice - item.discount)}</strong></div>; })}</div><div className="pos-confirmation-total"><span>{customerName || "Customer"}</span><strong>{formatCurrency(cartTotal)}</strong></div><div className="primitive-dialog-actions px-0 pb-0"><Button type="button" variant="secondary" onClick={() => setCheckoutOpen(false)}>Cancel</Button><Button type="button" variant="brand" onClick={submitSale}><Check size={15} />Confirm sale</Button></div></div></Modal>
  </div>;
}

function SaleOrder({ cart, products, onRemove }: { cart: CartLine[]; products: Product[]; onRemove: (productId: string) => void }) {
  return <section className="pos-section pos-cart-section">{cart.length ? <div className="pos-cart-list"><div className="pos-cart-list-header" aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 36px 96px 22px", columnGap: 14, alignItems: "center", padding: "0 0 8px", color: "var(--text-muted)", fontSize: 9, fontWeight: 500 }}><span>Product</span><span style={{ textAlign: "center" }}>Qty</span><span style={{ textAlign: "center" }}>Unit price</span><span /></div>{cart.map((item) => { const product = products.find((entry) => entry.id === item.productId); if (!product) return null; return <div className="pos-cart-item" key={item.productId} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 36px 96px 22px", columnGap: 14, alignItems: "center", border: "none", borderRadius: 0, background: "transparent", boxShadow: "none", padding: "8px 0" }}><div className="pos-cart-product" style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", color: "var(--text-primary)", fontSize: 12, fontWeight: 700, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</strong><small style={{ display: "block", marginTop: 3, overflow: "hidden", color: "var(--text-primary)", fontSize: 10, fontWeight: 400, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.color || "Unspecified"}</small></div><span className="pos-cart-item-quantity" style={{ color: "var(--text-primary)", fontSize: 10, fontWeight: 800, textAlign: "center" }}>{item.quantity}</span><strong className="pos-cart-item-total" style={{ color: "var(--text-primary)", fontSize: 10, textAlign: "center", whiteSpace: "nowrap" }}>{formatCurrency(item.unitSellingPrice)}</strong><button type="button" onClick={() => onRemove(item.productId)} aria-label={`Remove ${product.name}`} style={{ display: "grid", width: 22, height: 22, placeItems: "center", border: 0, background: "transparent", color: "var(--error)", cursor: "pointer" }}><Trash2 size={14} /></button></div>; })}</div> : <div className="pos-cart-empty" style={{ gap: 0 }}><Image src="/cart-icon.png" alt="" width={58} height={58} className="pos-empty-cart-image" style={{ display: "block", marginBottom: 2 }} /><strong style={{ margin: 0, color: "var(--text-primary)", lineHeight: 1.1 }}>Your order is empty</strong><span style={{ margin: 0, color: "var(--text-primary)", lineHeight: 1.1 }}>Select an in-stock product to begin.</span></div>}</section>;
}

type TradeInOrderProps = { mode: "exchange" | "buyback"; products: Product[]; suppliers: Array<{ id: string; name: string; contactNumber: string; company: string }>; givenProductId: string; givenQuantity: string; tradeInUnitValue: string; receivedProductId: string; receivedQuantity: string; receivedUnitSellingPrice: string; receiveSource: "inventory" | "supplier"; supplierId: string; supplierName: string; supplierContactNumber: string; supplierCompany: string; supplierUnitCost: string; supplierPaidAmount: string; onGivenProduct: (value: string) => void; onGivenQuantity: (value: string) => void; onTradeInValue: (value: string) => void; onReceivedProduct: (value: string) => void; onReceivedQuantity: (value: string) => void; onSellingPrice: (value: string) => void; onReceiveSource: (value: "inventory" | "supplier") => void; onSupplier: (value: string) => void; onSupplierName: (value: string) => void; onSupplierContact: (value: string) => void; onSupplierCompany: (value: string) => void; onSupplierCost: (value: string) => void; onSupplierPaid: (value: string) => void };

function TradeInOrder(props: TradeInOrderProps) {
  const tradeInTotal = (Number(props.givenQuantity) || 0) * (Number(props.tradeInUnitValue) || 0);
  const replacementTotal = (Number(props.receivedQuantity) || 0) * (Number(props.receivedUnitSellingPrice) || 0);
  const balance = replacementTotal - tradeInTotal;
  return <section className="pos-section pos-trade-section"><div className="pos-section-title"><ArrowLeftRight size={15} /><h3>{props.mode === "buyback" ? "Phone purchased" : "Trade-in and replacement"}</h3></div><div className="pos-trade-card"><p className="pos-card-eyebrow">Customer gives</p><SelectField label="Phone" searchable value={props.givenProductId} onChange={(event) => props.onGivenProduct(event.target.value)}>{props.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.color}</option>)}</SelectField><div className="pos-two-fields"><Field label="Quantity" type="number" min={1} value={props.givenQuantity} onChange={(event) => props.onGivenQuantity(event.target.value)} /><Field label={props.mode === "buyback" ? "Purchase value / phone" : "Trade-in value / phone"} type="number" min={1} value={props.tradeInUnitValue} onChange={(event) => props.onTradeInValue(event.target.value)} /></div></div>{props.mode === "exchange" && <><div className="pos-trade-card"><p className="pos-card-eyebrow">Customer receives</p><SelectField label="Replacement phone" searchable value={props.receivedProductId} onChange={(event) => props.onReceivedProduct(event.target.value)}>{props.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.color} · {product.inStockQuantity} in stock</option>)}</SelectField><div className="pos-two-fields"><Field label="Quantity" type="number" min={1} value={props.receivedQuantity} onChange={(event) => props.onReceivedQuantity(event.target.value)} /><Field label="Selling price / phone" type="number" min={1} value={props.receivedUnitSellingPrice} onChange={(event) => props.onSellingPrice(event.target.value)} /></div><SelectField label="Replacement source" value={props.receiveSource} onChange={(event) => props.onReceiveSource(event.target.value as "inventory" | "supplier")}><option value="inventory">Use available inventory</option><option value="supplier">Arrange from supplier</option></SelectField></div>{props.receiveSource === "supplier" && <div className="pos-trade-card"><p className="pos-card-eyebrow">Supplier arrangement</p><SelectField label="Existing supplier" value={props.supplierId} onChange={(event) => props.onSupplier(event.target.value)}><option value="">+ New supplier</option>{props.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</SelectField><div className="pos-two-fields"><Field label="Supplier name" value={props.supplierName} onChange={(event) => props.onSupplierName(event.target.value)} placeholder="Supplier name" /><Field label="Supplier contact" value={props.supplierContactNumber} onChange={(event) => props.onSupplierContact(event.target.value)} placeholder="0300 1234567" /></div><Field label="Company (optional)" value={props.supplierCompany} onChange={(event) => props.onSupplierCompany(event.target.value)} placeholder="Company" /><div className="pos-two-fields"><Field label="Supplier cost / phone" type="number" min={1} value={props.supplierUnitCost} onChange={(event) => props.onSupplierCost(event.target.value)} /><Field label="Paid to supplier" type="number" min={0} value={props.supplierPaidAmount} onChange={(event) => props.onSupplierPaid(event.target.value)} /></div></div>}</>}{props.mode === "exchange" && <div className="pos-trade-balance"><span>{balance >= 0 ? "Customer pays" : "Customer credit"}</span><strong>{formatCurrency(Math.abs(balance))}</strong></div>}{props.mode === "buyback" && <div className="pos-trade-balance"><span>Customer payout</span><strong>{formatCurrency(tradeInTotal)}</strong></div>}</section>;
}
