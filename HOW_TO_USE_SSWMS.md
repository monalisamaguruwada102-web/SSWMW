# SmartStore WMS — User Guide

Welcome to the SmartStore Warehouse Management System (SSWMS). This guide will walk you through the core workflow and explain how the different moving parts of the system interact.

## 1. The Foundation (Setup)
Before you can track any stock, the system needs to know **what** you're tracking and **where** it can go.

*   **Categories:** Go to the **Products** page and use the Category filter to see existing categories. (Admins can add categories via the API or directly if the feature is exposed). This groups your products (e.g., Electronics, Raw Materials, Packaging).
*   **Storage Locations:** Go to the **Storage** page. Define the physical spaces in your warehouse using the format `Section-Rack-Shelf` (e.g., `A-01-01`). You can also set a maximum capacity for each location to monitor warehouse utilization.
*   **Products:** Go to the **Products** page. Register the items you handle. Every product gets a unique SKU, a Category, a measurement unit (pcs, kg, box), and a **Minimum Stock Level**.

## 2. Bringing Goods In (Movements)
Stock doesn't magically appear in inventory; it must be recorded.

*   When an order arrives from a supplier, go to the **Movements** page.
*   Click **Record Movement** and select the type **Incoming**.
*   Select the Product, enter the Quantity, and specify the **To Location** (where you are putting it on the shelves).
*   *Background Magic:* As soon as you save this movement, the system automatically updates the **Inventory** table, adding that product's quantity to that specific physical location.

## 3. Sending Goods Out
There are two ways goods leave the warehouse:

*   **Direct Dispatch (Movements):** If an admin or staff member is physically removing stock to send to a customer or use internally, go to the **Movements** page. Record a movement as **Outgoing**. Specify the product, the quantity, and the **From Location** (where it was taken from). This instantly deducts the quantity from the inventory at that location.
*   **Order Pipeline (Orders):** If someone needs items but requires approval first, they create a **New Order** on the **Orders** page. The order starts as `Pending`. An Admin reviews it and marks it `Approved`. Then it moves to `Processing` (while goods are gathered) and finally `Completed`. *(Note: Completing an order is a workflow status; staff still need to log an actual "Outgoing" movement to reflect the physical stock leaving the warehouse).*

## 4. Internal Transfers
If you are moving stock from one shelf to another within the warehouse:
*   Go to **Movements** -> **Record Movement**.
*   Select type **Transfer**.
*   Specify both a **From Location** and a **To Location**.
*   This will deduct stock from the source and add it to the destination without changing your total warehouse inventory.

## 5. Managing Stock (Inventory)
The **Inventory** page is your real-time snapshot of what is sitting on your shelves right now.

*   It calculates total stock by looking at all standard inventory entries across all locations.
*   If you perform a physical count and find a discrepancy (e.g., a physical count shows 45 items but the system says 50), click the **Adjust** button next to the item.
*   Enter the correct new quantity and a reason note.
*   *Background Magic:* Any adjustment automatically writes an adjustment log to the **Inventory History** (accessible via the History button at the top), providing a permanent audit trail of who changed numbers manually and why.

## 6. Alerts & Reporting
*   **Low Stock Alerts:** If a product's total physical inventory drops below the **Minimum Stock Level** you set for it, the system immediately tags it.
    *   This triggers a **Notification** (the bell icon in the top right will get a red dot).
    *   The low-stock item will also appear on the **Dashboard** in the Alerts section.
*   **Reports:** Need to share data? Go to the **Reports** page. You can instantly generate reports for Inventory Snapshots, Stock Movements, Low Stock Items, or Activity Logs. You can export these as a CSV for Excel or a formatted PDF.

## 7. User Roles
*   **Admin (`admin`):** Has full access. Can view and manage Users, approve/cancel Orders, add Storage Locations, add/edit/delete Products, and view the Activity Log.
*   **Staff (`staff`):** Has operational access. Cannot manage users, cannot approve orders (only create them), and has restricted destructive actions (cannot delete products).

All of this runs strictly locally on a fast, C-compiled SQLite file database (`data/warehouse.db`).
