// Это фрагмент кода для замены секции "Все зарплаты" в /app/dashboard/page.tsx
// Найдите секцию с заголовком "Все зарплаты (14)" и замените весь блок на этот код:

            {/* All Salaries */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg">
              <div className="p-6 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Все зарплаты ({data?.salaries?.length || 0})
                  </h2>
                  <button
                    onClick={() => setShowAllSalaries(!showAllSalaries)}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {showAllSalaries ? 'Скрыть' : 'Показать все'}
                    {showAllSalaries ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              {(showAllSalaries || (!showAllSalaries && data?.salaries && data.salaries.length <= 10)) && (
                <div className="p-6">
                  {/* Managers Section */}
                  {managers.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 text-blue-400">Менеджеры</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-700">
                              <th className="text-left py-3 px-4 text-gray-400">Менеджер</th>
                              <th className="text-right py-3 px-4 text-gray-400">База</th>
                              <th className="text-right py-3 px-4 text-gray-400">Итого</th>
                              <th className="text-center py-3 px-4 text-gray-400">Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            {managers.map((salary) => (
                              <tr key={salary.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                <td className="py-3 px-4 font-medium">{salary.employee?.username}</td>
                                <td className="py-3 px-4 text-right">${salary.base_salary.toFixed(2)}</td>
                                <td className="py-3 px-4 text-right font-bold text-green-400">
                                  ${salary.total_salary.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    salary.is_paid ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                                  }`}>
                                    {salary.is_paid ? 'Оплачено' : 'Ожидает'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Active Workers Section */}
                  {(() => {
                    // Разделяем активных и уволенных работников
                    const activeWorkers = workers.filter(s => {
                      const emp = data?.employees?.find(e => e.id === s.employee_id)
                      return emp && emp.is_active
                    })
                    
                    const firedWorkers = workers.filter(s => {
                      const emp = data?.employees?.find(e => e.id === s.employee_id)
                      return emp && !emp.is_active
                    })
                    
                    return (
                      <>
                        {/* Активные сотрудники */}
                        {activeWorkers.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-3 text-green-400">Сотрудники</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-gray-700">
                                    <th className="text-left py-3 px-4 text-gray-400">Сотрудник</th>
                                    <th className="text-right py-3 px-4 text-gray-400">База</th>
                                    <th className="text-right py-3 px-4 text-gray-400">Бонус</th>
                                    <th className="text-right py-3 px-4 text-gray-400">Лидер</th>
                                    <th className="text-right py-3 px-4 text-gray-400">Итого</th>
                                    <th className="text-center py-3 px-4 text-gray-400">Статус</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(showAllSalaries ? activeWorkers : activeWorkers.slice(0, 10)).map((salary) => (
                                    <tr key={salary.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                      <td className="py-3 px-4 font-medium">{salary.employee?.username}</td>
                                      <td className="py-3 px-4 text-right">${salary.base_salary.toFixed(2)}</td>
                                      <td className="py-3 px-4 text-right">
                                        {salary.bonus > 0 ? `$${salary.bonus.toFixed(2)}` : '-'}
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        {salary.leader_bonus > 0 ? (
                                          <span className="text-yellow-400">${salary.leader_bonus.toFixed(2)}</span>
                                        ) : '-'}
                                      </td>
                                      <td className="py-3 px-4 text-right font-bold text-green-400">
                                        ${salary.total_salary.toFixed(2)}
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                          salary.is_paid ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                                        }`}>
                                          {salary.is_paid ? 'Оплачено' : 'Ожидает'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        
                        {/* Уволенные сотрудники */}
                        {firedWorkers.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3 text-red-400">Уволенные</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-gray-700">
                                    <th className="text-left py-3 px-4 text-gray-400">Сотрудник</th>
                                    <th className="text-right py-3 px-4 text-gray-400">База</th>
                                    <th className="text-right py-3 px-4 text-gray-400">Бонус</th>
                                    <th className="text-right py-3 px-4 text-gray-400">Лидер</th>
                                    <th className="text-right py-3 px-4 text-gray-400">Итого</th>
                                    <th className="text-center py-3 px-4 text-gray-400">Статус</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {firedWorkers.map((salary) => (
                                    <tr key={salary.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 opacity-60">
                                      <td className="py-3 px-4 font-medium">
                                        <span className="text-red-400">{salary.employee?.username}</span>
                                        <span className="ml-2 text-xs text-red-500">(Уволен)</span>
                                      </td>
                                      <td className="py-3 px-4 text-right">${salary.base_salary.toFixed(2)}</td>
                                      <td className="py-3 px-4 text-right">
                                        {salary.bonus > 0 ? `$${salary.bonus.toFixed(2)}` : '-'}
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        {salary.leader_bonus > 0 ? (
                                          <span className="text-yellow-400">${salary.leader_bonus.toFixed(2)}</span>
                                        ) : '-'}
                                      </td>
                                      <td className="py-3 px-4 text-right font-bold text-red-400">
                                        ${salary.total_salary.toFixed(2)}
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        <span className="px-2 py-1 rounded-full text-xs bg-red-900/30 text-red-400">
                                          Уволен
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
