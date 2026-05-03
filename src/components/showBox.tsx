import type { TimelineItem, Plan, Tran } from '../db';
import { FaClock } from "react-icons/fa6";
import { FaEdit } from "react-icons/fa";

export function ShowBox({ item, showEdit, onEdit }: { item: TimelineItem; showEdit?: boolean; onEdit?: (item: Plan | Tran) => void }) {
  const formatTimeWithOffset = (iso: string, offset?: number) => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    const off = typeof offset === 'number' ? offset : 0;
    const d = new Date(parsed.getTime() + off * 3600000);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const hour12 = ((h + 11) % 12) + 1;
    const ampm = h < 12 ? 'AM' : 'PM';
    const mm = String(m).padStart(2, '0');
    return `${hour12}:${mm} ${ampm}`;
  };
  const formatOffsetLabel = (offset?: number) => {
    const off = typeof offset === 'number' ? offset : 0;
    const sign = off >= 0 ? '+' : '';
    return `UTC${sign}${off}`;
  };
  if (item.type === 'plan') {
    return (
      <div
        className={`plan-details p-5 rounded-3xl shadow-sm gap-4 flex flex-col ${item.typeName === 'Hotel' ? 'bg-orange-100' : ''}`}
        style={{
          boxShadow: "inset 3px 3px 6px #A3A3A3FF, inset -3px -3px 6px #F0F0F0FF"
        }}
      >
        {/* Images removed from place schema; derive display fields from google_maps_json */}
        <div>
          <div className='flex justify-between items-center w-full'>
            <div
              className="font-black text-2xl w-[60%]"
            >
              {item.place.name}
              {showEdit && (
              <button
                className='text-orange-700 text-lg ml-2'
                onClick={() => onEdit && onEdit(item)}
              >
                <FaEdit />
              </button>
            )}
            </div>
            {formatTimeWithOffset(item.time, (item as any).utc) && (
              <div className='w-[40%] flex flex-row items-baseline justify-end gap-1'>
                <h1 className='text-nowrap text-end text-lg text-orange-700'>
                  {formatTimeWithOffset(item.time, (item as any).utc)}
                </h1>
                <p className='text-xs'>{formatOffsetLabel((item as any).utc).split('UTC')[1]}</p>
              </div>
            )}
          </div>
            {/* JP name removed; show link to original maps URL when available */}
            <div className="flex gap-2 flex-wrap">
              <a href={item.place.originalUrl ? item.place.originalUrl : item.place.name}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:underline active:underline">Location</a>
              {item.place.url && (
                <a href={item.place.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline active:underline">Website</a>
              )}
            </div>
        </div>
        
          <div className="flex items-center gap-4">
            {item.stay && (
            <>
            <FaClock />
            <p className="text-sm">{(() => {
              const h = Math.floor(item.stay / 60);
              const m = item.stay % 60;
              return h ? (m ? `${h} h ${m} ${m > 1 ? 'mins' : 'min'}` : `${h} h`) : `${m} ${m > 1 ? 'mins' : 'min'}`;
            })()}</p>
            </>
            )}
            {item.typeName && (
              <span className="text-sm font-bold text-orange-700">{item.typeName}</span>
            )}
          </div>

        {(item.place.info || item.info) && <hr className='text-orange-700' />}
        <div className='gap-1 flex flex-col'>
          {item.place.info && <p className={`text-sm text-white  ${item.typeName === 'Hotel' ? 'bg-gray-700' : 'bg-gray-500'} p-3 rounded-xl`}>{item.place.info.split('\\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>}
          {item.info && <p className={`text-sm text-white  ${item.typeName === 'Hotel' ? 'bg-gray-700' : 'bg-gray-500'} p-3 rounded-xl`}>{item.info.split('\\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>}
        </div>
      </div>
    );
  }

  // tran item
  return (
    <div
      className="plan-details p-5 rounded-3xl shadow-sm gap-4 flex flex-col"
      style={{
        boxShadow: "inset 3px 3px 6px #A3A3A3FF, inset -3px -3px 6px #F0F0F0FF"
      }}
    >
      <div>
        <div className='flex justify-between items-center w-full'>
          <h1 className="font-black text-2xl w-[60%]">
            {item.name}
            {showEdit && (
              <button
                className='text-orange-700 text-lg ml-2'
                onClick={() => onEdit && onEdit(item)}
              >
                <FaEdit />
              </button>
            )}
          </h1>
          {formatTimeWithOffset(item.time, (item as any).utc) && (
            <div className='w-[40%] flex flex-row items-baseline justify-end gap-1'>
              <h1 className='text-nowrap text-end text-lg text-orange-700'>
                {formatTimeWithOffset(item.time, (item as any).utc)}
              </h1>
              <p className='text-xs'>{formatOffsetLabel((item as any).utc).split('UTC')[1]}</p>
            </div>
          )}
        </div>
        {item.url && (
          <a href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline">Website</a>
        )}
      </div>
      {item.stay && <div className="flex items-center gap-2"><FaClock /><p className="text-sm">{(() => {
          const h = Math.floor(item.stay / 60);
          const m = item.stay % 60;
          return h ? (m ? `${h} h ${m} ${m > 1 ? 'mins' : 'min'}` : `${h} h`) : `${m} ${m > 1 ? 'mins' : 'min'}`;
        })()}</p></div>}
      {item.info && <hr className='text-orange-700' />}
      {item.info && <p className="text-sm text-white bg-gray-500 p-3 rounded-xl">{item.info.split('\\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>}
    </div>
  );
}

