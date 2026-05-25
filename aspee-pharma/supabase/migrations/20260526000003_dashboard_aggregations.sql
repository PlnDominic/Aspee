-- Dashboard Aggregations for High Performance
-- This migration provides high-speed counters and sums for the main dashboard.

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    result jsonb;
    total_products bigint;
    total_customers bigint;
    active_pos bigint;
    low_stock_count bigint;
    todays_revenue numeric;
    outstanding_total numeric;
    outstanding_count bigint;
    sales_last_7_days jsonb;
    revenue_last_6_months jsonb;
BEGIN
    -- Basic counts
    SELECT count(*) INTO total_products FROM public.products;
    SELECT count(*) INTO total_customers FROM public.customers;
    SELECT count(*) INTO active_pos FROM public.purchase_orders WHERE status NOT IN ('Received', 'Cancelled');

    -- Low stock count (Efficiently done in DB)
    -- We join stock_levels with products to check reorder_level
    SELECT count(*)
    INTO low_stock_count
    FROM (
        SELECT sl.product_id
        FROM public.stock_levels sl
        JOIN public.products p ON p.id = sl.product_id
        GROUP BY sl.product_id, p.reorder_level
        HAVING sum(sl.qty_on_hand) <= coalesce(p.reorder_level, 0)
    ) low_stock_products;

    -- Invoice stats
    SELECT 
        coalesce(sum(CASE WHEN date = current_date AND status <> 'Draft' THEN total_amount ELSE 0 END), 0),
        coalesce(sum(CASE WHEN status IN ('Issued', 'Partially Paid', 'Overdue') THEN total_amount ELSE 0 END), 0),
        count(*) FILTER (WHERE status IN ('Issued', 'Partially Paid', 'Overdue'))
    INTO todays_revenue, outstanding_total, outstanding_count
    FROM public.sales_invoices;

    -- Last 7 days sales
    WITH last_7 AS (
        SELECT generate_series(current_date - interval '6 days', current_date, interval '1 day')::date AS d
    ),
    daily_sales AS (
        SELECT l.d, coalesce(sum(s.total_amount), 0) AS sales
        FROM last_7 l
        LEFT JOIN public.sales_invoices s ON s.date = l.d AND s.status <> 'Draft'
        GROUP BY l.d
    )
    SELECT jsonb_agg(jsonb_build_object('name', to_char(d, 'Dy'), 'date', d, 'sales', sales) ORDER BY d)
    INTO sales_last_7_days
    FROM daily_sales;

    -- Last 6 months revenue
    WITH last_6 AS (
        SELECT date_trunc('month', generate_series(current_date - interval '5 months', current_date, interval '1 month'))::date AS m
    ),
    monthly_revenue AS (
        SELECT l.m, coalesce(sum(s.total_amount), 0) AS revenue
        FROM last_6 l
        LEFT JOIN public.sales_invoices s ON date_trunc('month', s.date) = l.m AND s.status <> 'Draft'
        GROUP BY l.m
    )
    SELECT jsonb_agg(jsonb_build_object('name', to_char(m, 'Mon'), 'revenue', revenue) ORDER BY m)
    INTO revenue_last_6_months
    FROM monthly_revenue;

    result := jsonb_build_object(
        'totalProducts', total_products,
        'totalCustomers', total_customers,
        'activePOs', active_pos,
        'lowStockCount', coalesce(low_stock_count, 0),
        'todaysRevenue', todays_revenue,
        'outstandingTotal', outstanding_total,
        'outstandingCount', outstanding_count,
        'salesData', sales_last_7_days,
        'revenueData', revenue_last_6_months
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
