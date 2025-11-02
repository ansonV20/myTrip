import type { TimelineItem, Plan, Tran } from '../db';
import { FaClock } from "react-icons/fa6";
import { FaEdit } from "react-icons/fa";

export function ShowBox({ item, showEdit, onEdit }: { item: TimelineItem; showEdit?: boolean; onEdit?: (item: Plan | Tran) => void }) {
  if (item.type === 'plan') {
    return (
      <div
        className="plan-details p-5 rounded-3xl shadow-sm gap-4 flex flex-col"
        style={{
          boxShadow: "inset 3px 3px 6px #A3A3A3FF, inset -3px -3px 6px #F0F0F0FF"
        }}
      >
        <img src={item.place.img} alt={item.place.name} className="w-full h-48 object-cover rounded-xl" />
        <div>
          <div className='flex justify-between items-center w-full'>
            <div
              className="font-black text-2xl w-[80%] line-clamp-1"
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
            <div className='w-[20%] flex flex-col items-end gap-1'>
              <h1 className='text-nowrap text-end text-lg text-orange-700'>
                {new Date(item.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </h1>
            </div>
          </div>
          <h2 className="text-md text-gray-500 line-clamp-1">{item.place.jpname}</h2>
          <a href={item.place.map ? item.place.map : item.place.name}
              target="_blank"
              rel="noopener noreferrer"
              className="text-md text-gray-500 line-clamp-1">{item.place.loc}</a>
        </div>
        {item.stay && <div className="flex items-center gap-2"><FaClock /><p className="text-sm">{(() => {
          const h = Math.floor(item.stay / 60);
          const m = item.stay % 60;
          return h ? (m ? `${h} h ${m} ${m > 1 ? 'mins' : 'min'}` : `${h} h`) : `${m} ${m > 1 ? 'mins' : 'min'}`;
        })()}</p></div>}
        {(item.place.info || item.info) && <hr className='text-gray-500' />}
        <div className='gap-1 flex flex-col'>
          {item.place.info && <p className="text-sm text-white bg-gray-500 p-3 rounded-xl line-clamp-3">{item.place.info.split('\\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>}
          {item.info && <p className="text-sm text-white bg-gray-500 p-3 rounded-xl line-clamp-3">{item.info.split('\\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>}
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
          <h1 className="font-black text-2xl w-[80%] line-clamp-1">
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
          <div className='w-[20%] flex flex-col items-end gap-1'>
            <h1 className='text-nowrap text-end text-lg text-orange-700'>
              {new Date(item.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </h1>
          </div>
        </div>
      </div>
      {item.stay && <div className="flex items-center gap-2"><FaClock /><p className="text-sm">{(() => {
          const h = Math.floor(item.stay / 60);
          const m = item.stay % 60;
          return h ? (m ? `${h} h ${m} ${m > 1 ? 'mins' : 'min'}` : `${h} h`) : `${m} ${m > 1 ? 'mins' : 'min'}`;
        })()}</p></div>}
      {item.info && <hr className='text-gray-500' />}
      {item.info && <p className="text-sm text-white bg-gray-500 p-3 rounded-xl line-clamp-3">{item.info.split('\\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>}
    </div>
  );
}

