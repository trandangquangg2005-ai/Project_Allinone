"use client";

import { queued, queuedForm } from "@/lib/offline/wrap";
import * as server from "./actions";

// See finance/offline-actions.ts. Check-in and check-out carry their photo
// into the queue as well, so a lesson recorded in a basement still uploads.

export const saveStudent = queued("saveStudent", "Học sinh", server.saveStudent);
export const archiveStudent = queued("archiveStudent", "Ẩn/hiện học sinh", server.archiveStudent);
export const checkIn = queuedForm("checkIn", "Check-in", server.checkIn);
export const checkOut = queuedForm("checkOut", "Check-out", server.checkOut);
export const addManualLesson = queued("addManualLesson", "Buổi học", server.addManualLesson);
export const updateLesson = queued("updateLesson", "Sửa buổi học", server.updateLesson);
export const deleteLesson = queued("deleteLesson", "Xóa buổi học", server.deleteLesson);
export const recordPayment = queued("recordPayment", "Thu học phí", server.recordPayment);
export const deletePayment = queued("deletePayment", "Xóa khoản thu", server.deletePayment);
