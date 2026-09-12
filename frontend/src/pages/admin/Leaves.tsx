import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllLeaves, updateLeaveStatus } from '../../store/slices/leaveSlice';
import { RootState, AppDispatch } from '../../store';
import { CheckCircle, XCircle, Clock, Check, X as XIcon } from 'lucide-react';

const AdminLeaves = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { leaves, isLoading } = useSelector((state: RootState) => state.leaves);
  const [showModal, setShowModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [action, setAction] = useState<'Approved' | 'Rejected'>('Approved');
  const [adminComment, setAdminComment] = useState('');

  useEffect(() => {
    dispatch(fetchAllLeaves());
  }, [dispatch]);

  const handleActionClick = (leave: any, newStatus: 'Approved' | 'Rejected') => {
    setSelectedLeave(leave);
    setAction(newStatus);
    setAdminComment('');
    setShowModal(true);
  };

  const handleConfirm = () => {
    if (selectedLeave) {
      dispatch(updateLeaveStatus({
        id: selectedLeave._id,
        status: action,
        adminComment
      }));
      setShowModal(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'Approved') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'Rejected') return <XCircle className="h-5 w-5 text-red-500" />;
    return <Clock className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Approved') return 'bg-green-100 text-green-800';
    if (status === 'Rejected') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
        <p className="text-gray-500 mt-1">Review and manage employee leave requests</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading && leaves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Loading leaves...</td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No leave requests found</td>
                </tr>
              ) : (
                leaves.map((leave) => (
                  <tr key={leave._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {typeof leave.employeeId === 'object' ? leave.employeeId.name : 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {typeof leave.employeeId === 'object' ? leave.employeeId.department : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {leave.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(leave.status)}`}>
                        {getStatusIcon(leave.status)}
                        <span className="ml-1.5">{leave.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {leave.status === 'Pending' ? (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleActionClick(leave, 'Approved')}
                            className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-1.5 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <Check className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleActionClick(leave, 'Rejected')}
                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XIcon className="h-5 w-5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          Resolved {leave.adminComment && `(Commented)`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {action === 'Approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to {action.toLowerCase()} this leave request from{' '}
              <span className="font-semibold">{typeof selectedLeave?.employeeId === 'object' ? selectedLeave?.employeeId?.name : 'Employee'}</span>?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Add Comment (Optional)</label>
              <textarea
                rows={3}
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Reason for approval/rejection..."
              ></textarea>
            </div>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 py-2 px-4 text-white rounded-lg text-sm font-medium ${
                  action === 'Approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm {action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeaves;
