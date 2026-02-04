import { Cloud, Lock } from 'lucide-react';

interface StatsCardProps {
  type: 'records' | 'synced' | 'secure';
  value: number | string;
  label: string;
  sublabel?: string;
}

export default function StatsCard({ type, value, label, sublabel }: StatsCardProps) {
  const getColors = () => {
    switch (type) {
      case 'records':
        return { bg: 'bg-blue-50', text: 'text-blue-900', subtext: 'text-blue-700' };
      case 'synced':
        return { bg: 'bg-green-50', text: 'text-green-900', subtext: 'text-green-700' };
      case 'secure':
        return { bg: 'bg-gray-50', text: 'text-gray-900', subtext: 'text-gray-600' };
      default:
        return { bg: 'bg-gray-50', text: 'text-gray-900', subtext: 'text-gray-600' };
    }
  };

  const colors = getColors();

  return (
    <div className={`${colors.bg} rounded-xl p-6`}>
      <div className="flex items-center gap-2 mb-2">
        {type === 'synced' && <Cloud className="w-5 h-5 text-green-700" />}
        {type === 'secure' && <Lock className="w-4 h-4 text-gray-600" />}
      </div>
      <div className={`text-3xl font-semibold ${colors.text}`}>{value}</div>
      <div className={`${colors.subtext} mt-1`}>{label}</div>
      {sublabel && <div className="text-xs text-gray-500 mt-1">{sublabel}</div>}
    </div>
  );
}
