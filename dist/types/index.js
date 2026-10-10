"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalStatus = exports.RequestStatus = exports.RequestType = exports.Role = void 0;
var Role;
(function (Role) {
    Role["Admin"] = "Admin";
    Role["FinanceManager"] = "FinanceManager";
    Role["CEO"] = "CEO";
    Role["Technician"] = "Technician";
    Role["Receptionist"] = "Receptionist";
    Role["WarehouseManager"] = "WarehouseManager";
    Role["Accountant"] = "Accountant";
    Role["BranchManager"] = "BranchManager";
    Role["MaintenanceSupervisor"] = "MaintenanceSupervisor";
    Role["ProcurementOfficer"] = "ProcurementOfficer";
    Role["HousekeepingStaff"] = "HousekeepingStaff";
})(Role || (exports.Role = Role = {}));
var RequestType;
(function (RequestType) {
    RequestType["Maintenance"] = "Maintenance";
    RequestType["Warehouse"] = "Warehouse";
    RequestType["Procurement"] = "Procurement";
})(RequestType || (exports.RequestType = RequestType = {}));
var RequestStatus;
(function (RequestStatus) {
    RequestStatus["Pending"] = "Pending";
    RequestStatus["In_Progress"] = "In_Progress";
    RequestStatus["Awaiting_Confirmation"] = "Awaiting_Confirmation";
    RequestStatus["Completed"] = "Completed";
    RequestStatus["Rejected"] = "Rejected";
    RequestStatus["Reopened"] = "Reopened";
})(RequestStatus || (exports.RequestStatus = RequestStatus = {}));
var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["Pending_Finance"] = "Pending_Finance";
    ApprovalStatus["Pending_CEO"] = "Pending_CEO";
    ApprovalStatus["Approved"] = "Approved";
    ApprovalStatus["Rejected"] = "Rejected";
})(ApprovalStatus || (exports.ApprovalStatus = ApprovalStatus = {}));
