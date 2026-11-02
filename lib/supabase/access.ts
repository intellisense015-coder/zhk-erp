'use client'

import type { SupabaseClient } from '@supabase/supabase-js'

export type PermissionValue = {
  can_view: boolean
  can_edit: boolean
}

export type WorkspaceAccess = {
  workspaceId: string
  userId: string
  email: string
  memberName: string
  role: 'owner' | 'manager' | 'staff'
  status: 'active'
  permissions: Record<string, PermissionValue>
}

export const ERP_PERMISSION_ORDER = [
  'dashboard',
  'pos',
  'inventory',
  'sales',
  'purchases',
  'customers',
  'suppliers',
  'expenses',
  'capital',
  'transfers',
  'reports',
  'transactions',
  'invoices',
  'settings',
  'users',
  'audit_logs',
] as const

const ROUTE_PERMISSIONS: Array<{ prefix: string; permissionKey: string }> = [
  { prefix: '/dashboard/users', permissionKey: 'users' },
  { prefix: '/inventory', permissionKey: 'inventory' },
  { prefix: '/low-stock', permissionKey: 'inventory' },
  { prefix: '/pos', permissionKey: 'pos' },
  { prefix: '/sales', permissionKey: 'sales' },
  { prefix: '/purchases', permissionKey: 'purchases' },
  { prefix: '/customers', permissionKey: 'customers' },
  { prefix: '/suppliers', permissionKey: 'suppliers' },
  { prefix: '/expenses', permissionKey: 'expenses' },
  { prefix: '/capital', permissionKey: 'capital' },
  { prefix: '/transfers', permissionKey: 'transfers' },
  { prefix: '/reports', permissionKey: 'reports' },
  { prefix: '/transactions', permissionKey: 'transactions' },
  { prefix: '/invoices', permissionKey: 'invoices' },
  { prefix: '/settings', permissionKey: 'settings' },
  { prefix: '/dashboard', permissionKey: 'dashboard' },
]

export function permissionForPath(pathname: string) {
  return ROUTE_PERMISSIONS.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.permissionKey ?? null
}

export function canViewPermission(access: WorkspaceAccess, permissionKey: string) {
  if (permissionKey === 'users') return access.role === 'owner'
  return access.role === 'owner' || Boolean(access.permissions[permissionKey]?.can_view)
}

export function canEditPermission(access: WorkspaceAccess, permissionKey: string) {
  if (permissionKey === 'users') return access.role === 'owner'
  return access.role === 'owner' || Boolean(access.permissions[permissionKey]?.can_edit)
}

export function visiblePermissionKeys(access: WorkspaceAccess) {
  return new Set(ERP_PERMISSION_ORDER.filter((permissionKey) => canViewPermission(access, permissionKey)))
}

export function editablePermissionKeys(access: WorkspaceAccess) {
  return new Set(ERP_PERMISSION_ORDER.filter((permissionKey) => canEditPermission(access, permissionKey)))
}

export function firstPermittedPath(access: WorkspaceAccess) {
  const firstPermission = ERP_PERMISSION_ORDER.find((permissionKey) => canViewPermission(access, permissionKey))
  if (firstPermission === 'dashboard') return '/dashboard'
  if (firstPermission === 'pos') return '/pos'
  if (firstPermission === 'inventory') return '/inventory'
  if (firstPermission === 'sales') return '/sales'
  if (firstPermission === 'purchases') return '/purchases'
  if (firstPermission === 'customers') return '/customers'
  if (firstPermission === 'suppliers') return '/suppliers'
  if (firstPermission === 'expenses') return '/expenses'
  if (firstPermission === 'capital') return '/capital'
  if (firstPermission === 'transfers') return '/transfers'
  if (firstPermission === 'reports') return '/reports'
  if (firstPermission === 'transactions') return '/transactions'
  if (firstPermission === 'invoices') return '/invoices'
  if (firstPermission === 'settings') return '/settings'
  return firstPermission === 'users' ? '/dashboard/users' : null
}

export function safeInvitationId(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

export function invitationAcceptPath(invitationId: string) {
  return `/invite/accept?invitation=${encodeURIComponent(invitationId)}`
}

export function passwordSetupPath(invitationId: string) {
  return `/reset-password?invite=1&next=${encodeURIComponent(invitationAcceptPath(invitationId))}`
}

export async function loadCurrentWorkspaceAccess(
  supabase: SupabaseClient,
  requestedWorkspaceId?: string | null,
): Promise<{ data: WorkspaceAccess | null; error?: string }> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return { data: null, error: 'Your session has expired. Please sign in again.' }

  const buildMembershipQuery = (workspaceId?: string | null) => {
    let query = supabase
      .from('workspace_members')
      .select('workspace_id,user_id,member_name,role,status')
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .limit(1)
    if (workspaceId) query = query.eq('workspace_id', workspaceId)
    return query.maybeSingle()
  }

  let membershipResult = await buildMembershipQuery(requestedWorkspaceId)
  if (!membershipResult.data && requestedWorkspaceId) {
    membershipResult = await buildMembershipQuery()
  }
  if (membershipResult.error) return { data: null, error: membershipResult.error.message }
  if (!membershipResult.data) return { data: null }

  const membership = membershipResult.data as {
    workspace_id: string
    user_id: string
    member_name?: string | null
    role: string
    status: string
  }
  const role = membership.role === 'owner' || membership.role === 'manager' ? membership.role : 'staff'

  const { data: permissionRows, error: permissionError } = await supabase
    .from('workspace_member_permissions')
    .select('permission_key,can_view,can_edit')
    .eq('workspace_id', membership.workspace_id)
    .eq('user_id', userData.user.id)

  if (permissionError) return { data: null, error: permissionError.message }

  const permissions = Object.fromEntries(
    (permissionRows ?? []).map((row) => [
      row.permission_key,
      { can_view: Boolean(row.can_view), can_edit: Boolean(row.can_edit) },
    ]),
  )

  return {
    data: {
      workspaceId: membership.workspace_id,
      userId: userData.user.id,
      email: userData.user.email ?? '',
      memberName: membership.member_name?.trim() || userData.user.email?.split('@')[0] || 'Workspace member',
      role,
      status: 'active',
      permissions,
    },
  }
}
