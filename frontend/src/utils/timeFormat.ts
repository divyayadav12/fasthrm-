export const formatDuration = (totalMinutes: number): string => {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

export const getTaskLiveMinutes = (task: { totalDuration?: number; startedAt?: string | Date; status?: string }): number => {
  let minutes = Number(task.totalDuration) || 0;
  if (task.status === 'WORKING' && task.startedAt) {
    const elapsed = Math.max(0, Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000));
    minutes += elapsed;
  }
  return minutes;
};
