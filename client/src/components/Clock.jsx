"use client"

import { useState, useEffect } from "react"
import "./ClockS.css"

function Clock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [])

  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = date.getMinutes().toString().padStart(2, "0")
    const seconds = date.getSeconds().toString().padStart(2, "0")
    return `${hours}:${minutes}:${seconds}`
  }

  const formatDate = (date) => {
    const options = { weekday: "short", year: "numeric", month: "short", day: "numeric" }
    return date.toLocaleDateString("en-US", options)
  }

  return (
    <div className="clock">
      <div className="time">{formatTime(time)}</div>
      <div className="date">{formatDate(time)}</div>
    </div>
  )
}

export default Clock
