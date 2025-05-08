const isAuthenticated = (req, res, next) => {
  const sessionUser = req.session.user

  if (sessionUser) {
    return next()
  }

  console.warn("Unauthenticated access attempt.")
  return res.status(401).json({ message: "Authentication required" })
}

const isManager = (req, res, next) => {
  const sessionUser = req.session.user

  if (sessionUser && sessionUser.role === "manager") {
    return next()
  }

  console.warn("Unauthorized manager access attempt by:", sessionUser?.role || "unknown")
  return res.status(403).json({ message: "Access denied: Manager role required" })
}

const isAdmin = (req, res, next) => {
  const sessionUser = req.session.user

  if (sessionUser && sessionUser.role === "admin") {
    return next()
  }

  console.warn("Unauthorized admin access attempt by:", sessionUser?.role || "unknown")
  return res.status(403).json({ message: "Access denied: Admin role required" })
}

const isEmployee = (req, res, next) => {
  const sessionUser = req.session.user

  if (sessionUser && sessionUser.role === "employee") {
    return next()
  }

  console.warn("Unauthorized employee access attempt by:", sessionUser?.role || "unknown")
  return res.status(403).json({ message: "Access denied: Employee role required" })
}

const isSelfOrManagerOrAdmin = (req, res, next) => {
  const sessionUser = req.session.user
  const requestedId = Number.parseInt(req.params.employeeId || req.params.id, 10)

  if (!sessionUser) {
    return res.status(401).json({ message: "Authentication required" })
  }

  if (sessionUser.role === "admin" || sessionUser.role === "manager" || sessionUser.id === requestedId) {
    return next()
  }

  console.warn(`Unauthorized access attempt: ${sessionUser.role} trying to access ID ${requestedId}`)
  return res.status(403).json({ message: "Access denied: You can only access your own data" })
}

module.exports = {
  isAuthenticated,
  isManager,
  isAdmin,
  isEmployee,
  isSelfOrManagerOrAdmin,
}
