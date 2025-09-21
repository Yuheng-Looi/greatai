import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartRendererProps {
  chartData: {
    chartType: 'bar' | 'line' | 'pie' | 'doughnut';
    data: any;
    options?: any;
  };
}

const ChartRenderer: React.FC<ChartRendererProps> = ({ chartData }) => {
  const { chartType, data, options: customOptions } = chartData;

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
            color: '#475569', // slate-600
        }
      },
      title: {
        display: !!customOptions?.title,
        text: customOptions?.title,
        color: '#1e293b', // slate-800
        font: {
          size: 16,
          weight: 'bold',
        }
      },
      tooltip: {
        backgroundColor: '#f8fafc', // slate-50
        titleColor: '#1e293b', // slate-800
        bodyColor: '#475569', // slate-600
        borderColor: '#cbd5e1', // slate-300
        borderWidth: 1,
      }
    },
    scales: chartType === 'pie' || chartType === 'doughnut' ? {} : {
        x: {
            ticks: { color: '#64748b' }, // slate-500
            grid: { color: 'rgba(148, 163, 184, 0.2)' } // slate-400 with transparency
        },
        y: {
            ticks: { color: '#64748b' }, // slate-500
            grid: { color: 'rgba(148, 163, 184, 0.2)' } // slate-400 with transparency
        }
    }
  };
  
  // Deep merge default and custom options
  const options = { ...defaultOptions, ...customOptions };

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return <Bar options={options} data={data} />;
      case 'line':
        return <Line options={options} data={data} />;
      case 'pie':
        return <Pie options={options} data={data} />;
      case 'doughnut':
        return <Doughnut options={options} data={data} />;
      default:
        return <div className="text-red-600 p-4 text-center">Unsupported chart type: {chartType}</div>;
    }
  };

  return (
    <div className="my-4 p-6 bg-slate-50 rounded-lg border border-slate-200 relative" style={{ height: '400px' }}>
      {renderChart()}
    </div>
  );
};

export default ChartRenderer;
